# Arquitetura Zero-Trust SRE: Hardening de ACLs 2026

**Autor**: GTI / SRE Platform Lead  
**Data**: 31/03/2026  
**Status**: 🟢 Implementado e Validado

---

## 1. Visão Geral

Este documento descreve o processo de auditoria, bloqueio e migração de permissões de acesso nas partições de dados do servidor CORE-DATA-01, realizado em 31 de março de 2026.

O modelo adotado é o **Zero-Trust**: nenhum usuário ou grupo de domínio genérico possui acesso implícito a qualquer pasta sensível. O acesso é **sempre explícito, nominal e rastreável**.

---

## 2. Escopo da Auditoria

Três volumes foram auditados recursivamente:

- `/dados` — 3 departamentos
- `/dados-ext` — 20 departamentos
- `/dados-ext-II` — 4 departamentos

**Total de setores auditados: 27 departamentos**

---

## 3. Diagnóstico: O Problema Original

### 3.1 Vazamento Estrutural (CVE Interno)

Todas as pastas departamentais foram criadas com o grupo **`usuários do domínio`** como **Dono Primário** no Linux (`chgrp`). O impacto:

- Qualquer usuário da organização (estagiários, freelancers, visitantes de rede) conseguia listar, ler e em alguns casos **gravar** em pastas como:
  - `/dados-ext/diretoria` — `rwx` para todos os domínios
  - `/dados-ext/financeiro` — `rwx` para todos os domínios
  - `/dados-ext/contratos` — `rwx` para todos os domínios
  - `/dados-ext/fiscal` — `rwx` para todos os domínios

### 3.2 Tabela de Risco Original (Pré-Lockdown)

| Volume | Setores Críticos | Setores Seguros |
|--------|-----------------|-----------------|
| /dados | 2 | 1 |
| /dados-ext | 19 | 1 (publico) |
| /dados-ext-II | 4 | 0 |
| **Total** | **25** | **2** |

---

## 4. Solução Implementada: Lockdown em 3 Fases

### Fase 1 — Expurgo do Acesso Global (setfacl -x)

Remoção do grupo `usuários do domínio` das ACLs explícitas e default de todas as 25 pastas críticas:

```bash
setfacl -R -x g:"usuários do domínio" /dados-ext/financeiro
setfacl -R -x d:g:"usuários do domínio" /dados-ext/financeiro
setfacl -R -m o::--- /dados-ext/financeiro
setfacl -R -m d:o::--- /dados-ext/financeiro
```

### Fase 2 — Troca de Posse (chgrp)

O Dono Primário das pastas foi alterado de `usuários do domínio` para `administradores do domínio`. Isso fecha o último vetor de acesso oculto via permissões POSIX Unix:

```bash
chgrp -R "administradores do domínio" /dados-ext/financeiro
chmod -R g+rwX /dados-ext/financeiro
```

### Fase 3 — Garantia de Acesso para T.I. (setfacl -m)

Injeção explícita do grupo de T.I. em todas as pastas para evitar que a própria equipe de infraestrutura fique bloqueada:

```bash
setfacl -R -m g:"administradores do domínio":rwx /dados-ext/financeiro
setfacl -R -m d:g:"administradores do domínio":rwx /dados-ext/financeiro
```

---

## 5. Migração de Colaboradores (Turnover)

Durante a operação, dois usuários foram migrados:

### 5.1 Rayssa Miranda → Grayce Dias

| Pasta | Permissão Original | Permissão Transferida |
|-------|-------------------|----------------------|
| `/dados-ext/financeiro` | rwx | rwx |
| `/dados-ext/financeiro-rh` | rwx | rwx |
| `/dados-ext/fiscal-financeiro` | r-x | r-x |

### 5.2 Denilson Rocha → Leonardo Gomes

| Pasta | Permissão Original | Permissão Transferida |
|-------|-------------------|----------------------|
| `/dados-ext/expedicao` | rwx | rwx |
| `/dados-ext/gestao-adm` | rwx | rwx |
| `/dados-ext/fiscal-financeiro` | r-x | r-x |

**Validação**: `id grayce.dias` e `id leonardo.gomes` confirmaram existência no AD (UID 3085 e 3086).

---

## 6. Estado Pós-Lockdown: Estrutura Final

```
Qualquer pasta sensível (ex: /dados-ext/rh):

# owner: root
# group: administradores do domínio     ← Dono é T.I.
user::rwx
user:wanessa.mauricio:rwx               ← Acesso individual explícito
group::rwx
group:administradores do domínio:rwx   ← T.I. tem controle total
mask::rwx
other::---                              ← Anônimos bloqueados
```

---

## 7. Gerenciamento Via Dashboard

A partir de hoje, o gerenciamento visual de ACLs é feito pelo **SRE Dashboard** (esta plataforma), no menu **Samba > Compartilhamentos**:

- Clique no botão **🛡️ Permissões** da pasta desejada
- Adicione ou remova usuários/grupos pelo dropdown do Active Directory
- As alterações são aplicadas com `setfacl` recursivo em tempo real
- Toda operação é logada no sistema de auditoria

---

## 8. Scripts de Infraestrutura Gerados

| Script | Localização | Função |
|--------|-------------|--------|
| `lockdown_acls.py` | `/scripts/security/` | Expurgo global de usuários do domínio |
| `fix_ownership_acls.sh` | `/scripts/security/` | Troca de posse POSIX e garantia de admin |
| `audit_report_2026.md` | `/scripts/security/` | Relatório de auditoria completo |

---

## 9. Próximos Passos Recomendados

- [ ] Agendar re-auditoria automática mensal via cron
- [ ] Integrar alertas de ACL indevida no Dashboard SRE (notificação em tempo real)
- [ ] Documentar política formal de onboarding/offboarding de colaboradores no AD
