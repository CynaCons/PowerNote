/**
 * The keep-vs-delete fork for a non-empty scroll.
 * Same two verbs the agent must pass as content: keep | delete.
 */
export function ScrollDeleteChoices({
  onKeep,
  onDelete,
}: {
  onKeep: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="context-menu__item"
        data-testid="scroll-delete-keep"
        onClick={onKeep}
      >
        Keep notes
      </button>
      <button
        type="button"
        className="context-menu__item context-menu__item--danger"
        data-testid="scroll-delete-contents"
        onClick={onDelete}
      >
        Delete notes too
      </button>
    </>
  );
}
