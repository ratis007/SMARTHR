import Modal from './Modal';

export default function ConfirmationModal({
  title = 'Confirmation',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  const buttonClass = tone === 'danger'
    ? 'flex-1 justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors'
    : 'btn-primary flex-1 justify-center';

  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-gray-600">{message}</p>
        <div className="flex gap-3">
          <button type="button" className={buttonClass} onClick={onConfirm}>{confirmLabel}</button>
          <button type="button" className="btn-secondary flex-1" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
