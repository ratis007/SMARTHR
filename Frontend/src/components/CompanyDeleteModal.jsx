import Modal from './Modal';

export default function CompanyDeleteModal({ company, onArchive, onHardDelete, onCancel }) {
  return (
    <Modal title="Cycle de vie de l'entreprise" onClose={onCancel} size="md">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-gray-900">{company?.name}</p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Voulez-vous supprimer definitivement l'entreprise ou archiver l'entreprise ?
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          L'archivage desactive l'acces tout en conservant les employes, contrats et historiques. La suppression definitive est bloquee si un historique de paie existe.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" className="btn-secondary justify-center" onClick={onCancel}>Annuler</button>
          <button type="button" className="btn-primary justify-center" onClick={onArchive}>Archiver</button>
          <button type="button" className="justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors" onClick={onHardDelete}>
            Supprimer definitivement
          </button>
        </div>
      </div>
    </Modal>
  );
}
