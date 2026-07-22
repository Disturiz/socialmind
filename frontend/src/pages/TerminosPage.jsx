import { LegalDocument } from '../components/layout/LegalDocument'

export function TerminosPage() {
  return (
    <LegalDocument title="Términos y Condiciones" updatedLabel="Última actualización: 21 de julio de 2026">
      <section>
        <h2 className="font-bold text-primary-700 mb-1">1. Qué es SocialMind</h2>
        <p>
          SocialMind es una plataforma digital de acompañamiento pedagógico dirigida a niños y adolescentes
          en el espectro autista (grado 1), pensada para practicar habilidades sociales y emocionales bajo
          la supervisión de un padre, madre, tutor o especialista responsable. El uso de la plataforma por
          parte de un menor de edad debe realizarse siempre a través de la cuenta y bajo la supervisión de
          un adulto responsable registrado en SocialMind.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">2. Cuentas</h2>
        <p>
          Para usar SocialMind debes crear una cuenta como Padre/Madre/Tutor o como Especialista (terapeuta,
          psicólogo o docente). Al registrarte, te comprometes a proporcionar información veraz y a mantener
          la confidencialidad de tu contraseña. Eres responsable de toda la actividad que ocurra bajo tu
          cuenta. Las cuentas de administrador se asignan de forma interna y no están disponibles mediante
          el registro público.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">3. Uso permitido y prohibido</h2>
        <p>
          Puedes usar SocialMind para el acompañamiento pedagógico de los niños y niñas bajo tu
          responsabilidad, dentro de los límites descritos en esta plataforma. Queda expresamente
          <strong> prohibido copiar, reproducir, distribuir, publicar, modificar, realizar ingeniería
          inversa, hacer scraping automatizado o reutilizar</strong>, total o parcialmente, el contenido,
          los textos, las ilustraciones, el diseño visual, la estructura pedagógica o el código de
          SocialMind sin autorización previa y por escrito. Esta prohibición aplica tanto a fines
          comerciales como no comerciales.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">4. Naturaleza no clínica</h2>
        <p>
          SocialMind es una herramienta pedagógica y de acompañamiento. No constituye un servicio de
          diagnóstico, tratamiento ni asesoría médica o psicológica, y no reemplaza el criterio ni el
          trabajo de un profesional de la salud. Ante cualquier señal de malestar significativo, se
          recomienda consultar con un especialista.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">5. Uso de inteligencia artificial (Lumi)</h2>
        <p>
          Lumi, el personaje guía de la plataforma, utiliza inteligencia artificial para ofrecer
          conversaciones guiadas y contenido de apoyo emocional. Las respuestas de Lumi son generadas
          automáticamente, pueden no ser perfectas, y no deben interpretarse como consejo clínico. Se
          recomienda la supervisión de un adulto responsable durante el uso del Chat con Lumi.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">6. Propiedad intelectual</h2>
        <p>
          Todo el contenido de SocialMind —incluyendo textos, ilustraciones, el personaje Lumi, la
          estructura de los módulos y el código de la plataforma— es propiedad de SocialMind y está
          protegido por las leyes de propiedad intelectual aplicables. Todos los derechos están
          reservados.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">7. Suspensión o cierre de cuentas</h2>
        <p>
          SocialMind se reserva el derecho de suspender o cerrar cuentas que incumplan estos Términos,
          incluyendo el uso indebido descrito en la sección 3, sin perjuicio de otras acciones legales
          que puedan corresponder.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">8. Limitación de responsabilidad</h2>
        <p>
          SocialMind se ofrece "tal cual", sin garantías de disponibilidad ininterrumpida. En la medida
          permitida por la ley, SocialMind no será responsable por daños indirectos derivados del uso de
          la plataforma.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">9. Cambios a estos Términos</h2>
        <p>
          Estos Términos pueden actualizarse periódicamente. Los cambios relevantes se indicarán con una
          nueva fecha de "última actualización" en esta página.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">10. Contacto</h2>
        <p>
          Para preguntas sobre estos Términos, puedes escribir a soporte de SocialMind a través de los
          medios de contacto indicados en la plataforma.
        </p>
      </section>

      <p className="text-xs text-text-secondary italic border-t border-calm-border pt-4">
        Este documento es un borrador razonable y no constituye asesoría legal formal. Se recomienda
        revisión por un profesional del derecho antes de considerarlo definitivo.
      </p>
    </LegalDocument>
  )
}
