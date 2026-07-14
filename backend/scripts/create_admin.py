import argparse
import sys
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import hash_password


def main():
    parser = argparse.ArgumentParser(description="Crear usuario administrador en SocialMind")
    parser.add_argument("--email",     required=True,  help="Email del administrador")
    parser.add_argument("--password",  required=True,  help="Contraseña (mínimo 8 caracteres)")
    parser.add_argument("--full-name", default="Administrador", help="Nombre completo")
    args = parser.parse_args()

    if len(args.password) < 8:
        print("Error: la contraseña debe tener al menos 8 caracteres.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == args.email).first()
        if existing:
            print(f"Error: ya existe un usuario con el email '{args.email}'.", file=sys.stderr)
            sys.exit(1)

        admin = User(
            email=args.email,
            hashed_password=hash_password(args.password),
            full_name=args.full_name,
            role=UserRole.admin,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"Admin creado: {admin.email} (id={admin.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
