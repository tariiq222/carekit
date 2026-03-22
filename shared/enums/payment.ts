export enum PaymentMethod {
  MOYASAR = 'moyasar',
  BANK_TRANSFER = 'bank_transfer',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export enum TransferVerificationStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  AMOUNT_DIFFERS = 'amount_differs',
  SUSPICIOUS = 'suspicious',
  OLD_DATE = 'old_date',
  UNREADABLE = 'unreadable',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}
