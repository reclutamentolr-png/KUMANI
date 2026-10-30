'use client'

import type { CvTemplate } from '@/lib/cv'
import type { CvTemplateData } from './cvTemplateTypes'
import CvTemplateMinimal from './CvTemplateMinimal'
import CvTemplateClassic from './CvTemplateClassic'
import CvTemplateSidebar from './CvTemplateSidebar'
import CvTemplateModerno from './CvTemplateModerno'
import CvTemplateProfessionale from './CvTemplateProfessionale'
import CvTemplateElegante from './CvTemplateElegante'
import CvTemplateEuropeo from './CvTemplateEuropeo'

// I modelli si dispongono secondo lo spazio che hanno (anteprima stretta
// accanto al modulo, telefono, pagina pubblica), non secondo lo schermo
export default function CvTemplateRenderer({ template, cv }: { template: CvTemplate; cv: CvTemplateData }) {
  return (
    <div className="@container">
      <Template template={template} cv={cv} />
    </div>
  )
}

function Template({ template, cv }: { template: CvTemplate; cv: CvTemplateData }) {
  if (template === 'moderno') return <CvTemplateModerno cv={cv} />
  if (template === 'professionale') return <CvTemplateProfessionale cv={cv} />
  if (template === 'elegante') return <CvTemplateElegante cv={cv} />
  if (template === 'europeo') return <CvTemplateEuropeo cv={cv} />
  if (template === 'classic') return <CvTemplateClassic cv={cv} />
  if (template === 'sidebar') return <CvTemplateSidebar cv={cv} />
  return <CvTemplateMinimal cv={cv} />
}
