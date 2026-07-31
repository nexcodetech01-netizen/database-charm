interface ReturnToSaleItemsOptions {
  prepareEditor: () => void;
  closeCheckout: () => void;
  rollbackSaleStatus?: () => Promise<void>;
  onRollbackError?: (error: unknown) => void;
  onRollbackSettled?: () => void;
}

/** Fecha o checkout imediatamente; a reversão de status é melhor esforço. */
export function returnToSaleItems({
  prepareEditor,
  closeCheckout,
  rollbackSaleStatus,
  onRollbackError,
  onRollbackSettled,
}: ReturnToSaleItemsOptions): void {
  prepareEditor();
  closeCheckout();

  if (rollbackSaleStatus) {
    void rollbackSaleStatus()
      .catch((error: unknown) => {
        onRollbackError?.(error);
      })
      .finally(() => {
        onRollbackSettled?.();
      });
  } else {
    onRollbackSettled?.();
  }
}