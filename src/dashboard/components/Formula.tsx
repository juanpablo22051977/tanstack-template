// Lightweight LaTeX-style formula renderer. Avoids bundling KaTeX —
// converts a small set of TeX tokens into HTML markup that respects the
// same monospace + italic conventions.

const REPLACEMENTS: [RegExp, string][] = [
  [/\\dfrac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '<span class="frac"><span class="num">$1</span><span class="den">$2</span></span>'],
  [/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '<span class="frac"><span class="num">$1</span><span class="den">$2</span></span>'],
  [/\\times/g, '×'],
  [/\\beta/g, 'β'],
  [/\\sigma/g, 'σ'],
  [/\\mu/g, 'μ'],
  [/\\,/g, ' '],
  [/\\;/g, '  '],
  [/\\\\/g, ' '],
  [/_\{([^}]*)\}/g, '<sub>$1</sub>'],
  [/\^\{([^}]*)\}/g, '<sup>$1</sup>'],
  [/_([a-zA-Z0-9])/g, '<sub>$1</sub>'],
  [/\^([a-zA-Z0-9])/g, '<sup>$1</sup>'],
  [/\\,/g, ' '],
]

export function Formula({ tex, className = '' }: { tex: string; className?: string }) {
  let html = tex
  for (const [pat, sub] of REPLACEMENTS) {
    html = html.replace(pat, sub)
  }
  return (
    <span
      className={`formula ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
