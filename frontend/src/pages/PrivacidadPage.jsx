import { LegalDocument } from '../components/layout/LegalDocument'

export function PrivacidadPage() {
  return (
    <LegalDocument title="Política de Privacidad" updatedLabel="Última actualización: 21 de julio de 2026">
      <section>
        <h2 className="font-bold text-primary-700 mb-1">1. Qué datos recopilamos</h2>
        <p>
          Recopilamos los datos de la cuenta del adulto responsable (nombre, correo electrónico,
          contraseña cifrada) y los datos del perfil del niño o niña creado por ese adulto (nombre, edad,
          avatar elegido). También registramos la actividad dentro de la plataforma: emociones
          seleccionadas, escenarios completados, conversaciones con Lumi, pausas de la Zona de calma y
          progreso general.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">2. Para qué usamos estos datos</h2>
        <p>
          Usamos estos datos exclusivamente para brindar el servicio: mostrar el progreso del niño o niña,
          permitir el seguimiento pedagógico del especialista vinculado por el padre/madre, y mejorar la
          plataforma. Nunca usamos estos datos con fines publicitarios ni los vendemos a terceros.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">3. Con quién se comparten</h2>
        <p>
          Los datos de un niño o niña solo son visibles para el padre/madre/tutor que gestiona su cuenta
          y para el especialista que ese adulto vincule explícitamente al perfil. También trabajamos con
          proveedores de infraestructura y de inteligencia artificial necesarios para operar la plataforma
          (alojamiento del servidor y generación de respuestas de Lumi), quienes procesan los datos bajo
          sus propias condiciones de confidencialidad. No cedemos ni vendemos datos a terceros con fines
          comerciales.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">4. Seguridad</h2>
        <p>
          Las contraseñas se almacenan cifradas y nunca en texto plano. El acceso a los datos dentro de la
          plataforma está restringido según el rol de cada cuenta (padre, especialista, administrador).
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">5. Tus derechos</h2>
        <p>
          Como adulto responsable de una cuenta, puedes solicitar en cualquier momento el acceso, la
          corrección o la eliminación de los datos de tu hijo/a, escribiendo a través de los medios de
          contacto indicados en la plataforma.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">6. Retención y eliminación</h2>
        <p>
          Conservamos los datos mientras la cuenta permanezca activa. Si solicitas la eliminación de tu
          cuenta, eliminaremos los datos asociados salvo que la ley exija conservarlos por un periodo
          adicional.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">7. Almacenamiento en tu dispositivo</h2>
        <p>
          Para mantener tu sesión iniciada, SocialMind guarda tu token de acceso y datos básicos de tu
          cuenta en el almacenamiento local (localStorage) de tu navegador. Esta información no se
          comparte con terceros ni se usa con fines de rastreo publicitario, y se elimina automáticamente
          al cerrar sesión.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">8. Contacto</h2>
        <p>
          Para ejercer tus derechos de privacidad o resolver dudas sobre esta política, puedes escribir a
          través de los medios de contacto indicados en la plataforma.
        </p>
      </section>

      <p className="text-xs text-text-secondary italic border-t border-calm-border pt-4">
        Este documento es un borrador razonable y no constituye asesoría legal formal. Se recomienda
        revisión por un profesional del derecho antes de considerarlo definitivo.
      </p>
    </LegalDocument>
  )
}
