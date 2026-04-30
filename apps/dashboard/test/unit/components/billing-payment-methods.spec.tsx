import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PaymentMethodsPage from "@/app/(dashboard)/settings/billing/payment-methods/page"

const { useLocale, useSavedCards, useBillingMutations } = vi.hoisted(() => ({
  useLocale: vi.fn(),
  useSavedCards: vi.fn(),
  useBillingMutations: vi.fn(),
}))

vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("@/hooks/use-current-subscription", () => ({
  useSavedCards,
  useBillingMutations,
}))
vi.mock("@/components/features/breadcrumbs", () => ({
  Breadcrumbs: () => <div>Breadcrumbs</div>,
}))
vi.mock("@/components/features/list-page-shell", () => ({
  ListPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/features/page-header", () => ({
  PageHeader: ({
    title,
    description,
    children,
  }: {
    title: string
    description?: string
    children?: React.ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
}))

describe("PaymentMethodsPage", () => {
  const addSavedCard = vi.fn()
  const setDefault = vi.fn()
  const remove = vi.fn()
  const tokenize = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_MOYASAR_PLATFORM_PUBLISHABLE_KEY", "pk_test_abc")
    addSavedCard.mockResolvedValue({ id: "card-new" })
    setDefault.mockResolvedValue({ id: "card-2", isDefault: true })
    remove.mockResolvedValue({ ok: true })
    tokenize.mockResolvedValue({ id: "token_abc" })
    Object.defineProperty(window, "Moyasar", {
      configurable: true,
      value: { tokenize },
    })
    useLocale.mockReturnValue({
      locale: "en",
      t: (key: string) =>
        ({
          "billing.paymentMethods.title": "Payment methods",
          "billing.paymentMethods.description": "Manage cards used for CareKit subscription billing.",
          "billing.paymentMethods.add": "Add card",
          "billing.paymentMethods.default": "Default",
          "billing.paymentMethods.setDefault": "Set default",
          "billing.paymentMethods.remove": "Remove",
          "billing.paymentMethods.empty": "No saved cards yet.",
          "billing.paymentMethods.smallVerification": "A small verification charge is refunded immediately.",
          "billing.paymentMethods.cardNumber": "Card number",
          "billing.paymentMethods.cardHolder": "Cardholder name",
          "billing.paymentMethods.expiryMonth": "Month",
          "billing.paymentMethods.expiryYear": "Year",
          "billing.paymentMethods.cvc": "CVC",
          "billing.paymentMethods.confirmSetDefault": "Use this card for future invoices?",
          "billing.paymentMethods.confirmRemove": "Remove this saved card?",
          "billing.paymentMethods.retryRequired": "Verification needs a retry.",
          "billing.paymentMethods.addFailed": "Could not add card.",
          "billing.actions.confirm": "Confirm",
          "billing.actions.back": "Back",
          "billing.actions.submitting": "Updating...",
        }[key] ?? key),
    })
    useBillingMutations.mockReturnValue({
      addSavedCardMut: { mutateAsync: addSavedCard, isPending: false },
      setDefaultSavedCardMut: { mutateAsync: setDefault, isPending: false },
      removeSavedCardMut: { mutateAsync: remove, isPending: false },
    })
  })

  it("renders saved cards with the default badge", () => {
    useSavedCards.mockReturnValue({
      isLoading: false,
      data: [{
        id: "card-1",
        brand: "visa",
        last4: "1111",
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
        createdAt: "2026-04-01T00:00:00.000Z",
      }],
    })

    render(<PaymentMethodsPage />)

    expect(screen.getByRole("heading", { name: "Payment methods" })).toBeInTheDocument()
    expect(screen.getByText("VISA")).toBeInTheDocument()
    expect(screen.getByText("•••• 1111")).toBeInTheDocument()
    expect(screen.getByText("Default")).toBeInTheDocument()
  })

  it("opens confirmation before setting a card as default", async () => {
    useSavedCards.mockReturnValue({
      isLoading: false,
      data: [{
        id: "card-2",
        brand: "master",
        last4: "2222",
        expiryMonth: 10,
        expiryYear: 2031,
        isDefault: false,
        createdAt: "2026-04-02T00:00:00.000Z",
      }],
    })

    render(<PaymentMethodsPage />)
    await userEvent.click(screen.getByRole("button", { name: "Set default" }))
    expect(screen.getByRole("alertdialog", { name: "Set default" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }))

    expect(setDefault).toHaveBeenCalledWith("card-2")
  })

  it("opens confirmation before removing a card", async () => {
    useSavedCards.mockReturnValue({
      isLoading: false,
      data: [{
        id: "card-3",
        brand: "visa",
        last4: "3333",
        expiryMonth: 9,
        expiryYear: 2032,
        isDefault: false,
        createdAt: "2026-04-03T00:00:00.000Z",
      }],
    })

    render(<PaymentMethodsPage />)
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(screen.getByRole("alertdialog", { name: "Remove" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }))

    expect(remove).toHaveBeenCalledWith("card-3")
  })

  it("tokenizes card input with Moyasar before adding the card", async () => {
    useSavedCards.mockReturnValue({ isLoading: false, data: [] })

    render(<PaymentMethodsPage />)
    await userEvent.click(screen.getByRole("button", { name: "Add card" }))
    await userEvent.type(screen.getByPlaceholderText("Cardholder name"), "Clinic Owner")
    await userEvent.type(screen.getByPlaceholderText("Card number"), "4111111111111111")
    await userEvent.type(screen.getByPlaceholderText("Month"), "12")
    await userEvent.type(screen.getByPlaceholderText("Year"), "2030")
    await userEvent.type(screen.getByPlaceholderText("CVC"), "123")
    await userEvent.click(screen.getByRole("button", { name: "Add card" }))

    await waitFor(() => expect(tokenize).toHaveBeenCalled())
    expect(addSavedCard).toHaveBeenCalledWith({
      moyasarTokenId: "token_abc",
      makeDefault: true,
    })
  })
})
