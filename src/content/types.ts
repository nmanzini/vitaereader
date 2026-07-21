export type Culture = 'greek' | 'roman'
export type WorkKind = 'life' | 'comparison'
export type ParagraphKind = 'prose' | 'poem' | 'noindent'

export interface Paragraph {
  id: string
  kind: ParagraphKind
  text: string
}

export interface Work {
  id: string
  slug: string
  title: string
  kind: WorkKind
  culture?: Culture
  sourceFile: string
  paragraphs: Paragraph[]
  wordCount: number
}
