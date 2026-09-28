import subprocess
import logging
import re
import os

logger = logging.getLogger("auth")

def check_ad_credentials(username, password):
    """
    Validate credentials against AD / Linux and check administrative privileges.
    Supports:
      - Active Directory via wbinfo (plaintext & NTLM)
      - Samba AD via smbclient
      - Linux PAM / local authentication
    Returns (True, None) on success, or (False, error_message) on failure.
    """
    if not username or not password:
        return False, "Usuário e senha são obrigatórios."

    try:
        raw_user = username.strip()
        # Clean user (strip domain prefix or UPN suffix)
        clean_user = raw_user.replace('\\', '/').split('/')[-1].split('@')[0].strip()
        
        logger.info(f"Iniciando autenticação para usuário: {clean_user} (input: {raw_user})")

        auth_succeeded = False

        # --- CAMADA 1: Validação via Winbind / AD (wbinfo) ---
        candidates = [
            clean_user,
            f"SRE CORE PLATFORM\\{clean_user}",
            f"{clean_user}@enterprise.local",
            raw_user
        ]
        
        for cand in candidates:
            try:
                cmd = ['wbinfo', '-a', f'{cand}%{password}']
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=8)
                stdout_lower = res.stdout.lower()
                if "succeeded" in stdout_lower or "plaintext password authentication succeeded" in stdout_lower:
                    logger.info(f"Autenticação bem-sucedida via wbinfo para candidato: {cand}")
                    auth_succeeded = True
                    break
            except Exception as e:
                logger.debug(f"wbinfo probe error for {cand}: {e}")

        # --- CAMADA 2: Validação via Samba SMB Client local ---
        if not auth_succeeded:
            try:
                cmd_smb = ['smbclient', '-L', '127.0.0.1', '-U', f'{clean_user}%{password}', '-m', 'SMB3']
                res_smb = subprocess.run(cmd_smb, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=8)
                if res_smb.returncode == 0:
                    logger.info(f"Autenticação bem-sucedida via smbclient local para: {clean_user}")
                    auth_succeeded = True
            except Exception as e:
                logger.debug(f"smbclient probe error: {e}")

        # --- CAMADA 3: Validação via PAM / Local su (Contingência Linux) ---
        if not auth_succeeded:
            try:
                p = subprocess.Popen(
                    ['su', '-c', 'true', clean_user],
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
                )
                stdout, stderr = p.communicate(input=password, timeout=5)
                if p.returncode == 0:
                    logger.info(f"Autenticação bem-sucedida via PAM/su para: {clean_user}")
                    auth_succeeded = True
            except Exception as e:
                logger.debug(f"su/pam probe error: {e}")

        if not auth_succeeded:
            logger.warning(f"Falha de autenticação para {clean_user}: Nenhuma camada validou as credenciais.")
            return False, "Credenciais inválidas. Verifique seu usuário e senha do domínio."

        # --- CAMADA DE AUTORIZAÇÃO: Verificação de Grupos Administrativos ---
        group_evidence = []
        
        # 1. Checagem via id Linux e id com domínio
        for probe_u in [clean_user, f"SRE CORE PLATFORM\\{clean_user}", raw_user]:
            try:
                cmd_id = ['id', probe_u]
                res_id = subprocess.run(cmd_id, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
                if res_id.returncode == 0:
                    group_evidence.append(res_id.stdout.lower())
            except Exception:
                pass

        # 2. Checagem via wbinfo -r (GIDs do domínio)
        for probe_u in [clean_user, f"SRE CORE PLATFORM\\{clean_user}"]:
            try:
                cmd_wb = ['wbinfo', '-r', probe_u]
                res_wb = subprocess.run(cmd_wb, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
                if res_wb.returncode == 0:
                    group_evidence.append(res_wb.stdout.lower())
            except Exception:
                pass

        combined_groups = " ".join(group_evidence)
        logger.debug(f"Evidências de grupos para {clean_user}: {combined_groups}")

        # Grupos permitidos: AD Domain Admins, Local Admins, Sudo Linux, Wheel
        allowed_tokens = [
            "administradores do domínio",
            "domain admins",
            "grp_adminslocais",
            "builtin\\administrators",
            "administrators",
            "sudo",
            "wheel",
            "root",
            "3001",  # GID de Administradores do Domínio no Samba enterprise
            "3002",  # GID de grp_adminslocais no Samba enterprise
            "3004",  # GID complementar de Domain Admin
            "3005",  # GID complementar
            "3007",  # GID de BUILTIN\administrators
            "27",    # GID de sudo no Debian/Ubuntu
            "0"      # GID de root
        ]

        for token in allowed_tokens:
            if token in combined_groups:
                logger.info(f"Acesso concedido com privilégios administrativos a {clean_user} (Critério: '{token}')")
                return True, None

        logger.warning(f"Acesso negado para {clean_user}: Usuário autenticado, mas não possui privilégios de administrador.")
        return False, "Acesso negado: Usuário não pertence a nenhum grupo de administradores."

    except Exception as e:
        logger.exception(f"Erro inesperado no módulo de autenticação para {username}: {e}")
        return False, f"Erro interno de autenticação: {str(e)}"
