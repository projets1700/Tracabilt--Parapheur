/** Petite icône du format de document (PDF, DOCX…). */
export default function IconeFormat({ format }) {
  return <span className={`icone-format ${format}`}>{(format || '?').toUpperCase()}</span>;
}
