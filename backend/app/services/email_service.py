import resend
from app.config import settings


def send_password_reset_email(to_email: str, full_name: str, token: str) -> None:
    resend.api_key = settings.resend_api_key
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    resend.Emails.send({
        "from": "noreply@socialmind.it.com",
        "to": to_email,
        "subject": "Recupera tu contraseña de SocialMind",
        "html": f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
          <h2>Hola, {full_name}</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña en SocialMind.</p>
          <p>
            <a href="{reset_url}"
               style="display:inline-block;padding:12px 24px;background:#5b8dd9;
                      color:white;border-radius:8px;text-decoration:none;font-weight:bold;">
              Restablecer contraseña
            </a>
          </p>
          <p>Este enlace expira en <strong>1 hora</strong>.</p>
          <p>Si no solicitaste este cambio, ignora este mensaje. Tu contraseña no cambiará.</p>
        </div>
        """,
    })
