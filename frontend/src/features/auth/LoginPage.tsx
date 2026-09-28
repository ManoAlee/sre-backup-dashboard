import React, { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Lock, User, ShieldAlert, Eye, EyeOff, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('error');
    }
    return null;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor, informe o usuário e senha do Active Directory.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        window.location.href = data.redirect || '/';
        return;
      }
      setError(data.error || 'Credenciais inválidas.');
      setIsLoading(false);
    } catch (err) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/login';

      const userField = document.createElement('input');
      userField.type = 'hidden';
      userField.name = 'username';
      userField.value = username;
      form.appendChild(userField);

      const pwdField = document.createElement('input');
      pwdField.type = 'hidden';
      pwdField.name = 'password';
      pwdField.value = password;
      form.appendChild(pwdField);

      document.body.appendChild(form);
      form.submit();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-8 shadow-xl space-y-6 animate-fade-in">
        
        {/* Brand Primary Logo */}
        <div className="flex flex-col items-center text-center space-y-3">
          <img
            src={BRAND.logoPrimary}
            alt={BRAND.company}
            className="h-12 w-auto object-contain py-1"
          />
          <div className="space-y-1 pt-2">
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">{BRAND.subtitle}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Autenticação Corporativa (Active Directory SSO)</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {capsLockActive && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Atenção: Caps Lock (Fixa) está ativado.</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Usuário de Rede (Active Directory)"
            placeholder="ex: seu.usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            icon={<User className="w-4 h-4 text-slate-400" />}
            autoFocus
          />

          <div className="relative">
            <Input
              label="Senha de Domínio"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              icon={<Lock className="w-4 h-4 text-slate-400" />}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title={showPassword ? 'Ocultar Senha' : 'Exibir Senha'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-xl shadow-xs cursor-pointer"
            isLoading={isLoading}
          >
            Entrar na Plataforma
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            {BRAND.company} — Sistema Protegido e Auditado.
          </p>
        </div>

      </div>
    </div>
  );
};
