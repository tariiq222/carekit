import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { InvoicesTable } from "@/app/(dashboard)/settings/billing/invoices/components/invoices-table"
import type { Invoice } from "@/lib/types/billing"

const { useLocale, useDownloadBillingInvoice } = vi.hoisted(() => ({
  useLocale: vi.fn(),
  useDownloadBillingInvoice: vi.fn(),
}))

vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("@/hooks/use-billing-invoices", () => ({ useDownloadBillingInvoice }))

function setupLocale() {
  useLocale.mockReturnValue({
    locale: "en",
    t: (k: string) => k,
  })
}

const baseInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: "inv-1",
  invoiceNumber: "INV-2026-000001",
  status: "PAID",
  amount: "115.00",
  currency: "SAR",
  periodStart: "2026-04-01T00:00:00.000Z",
  periodEnd: "2026-04-30T00:00:00.000Z",
  issuedAt: "2026-04-30T12:00:00.000Z",
  paidAt: "2026-04-30T12:01:00.000Z",
  ...overrides,
})

describe("InvoicesTable", () => {
  it("renders one row per invoice with all 5 statuses", () => {
    setupLocale()
    useDownloadBillingInvoice.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
    const invoices: Invoice[] = [
      baseInvoice({ id: "1", status: "DRAFT", invoiceNumber: null, issuedAt: null }),
      baseInvoice({ id: "2", status: "DUE" }),
      baseInvoice({ id: "3", status: "PAID" }),
      baseInvoice({ id: "4", status: "FAILED" }),
      baseInvoice({ id: "5", status: "VOID" }),
    ]

    const { container } = render(<InvoicesTable invoices={invoices} />)

    const rows = container.querySelectorAll("tbody tr")
    expect(rows).toHaveLength(5)
    expect(screen.getByText("billing.invoices.status.draft")).toBeInTheDocument()
    expect(screen.getByText("billing.invoices.status.due")).toBeInTheDocument()
    expect(screen.getByText("billing.invoices.status.paid")).toBeInTheDocument()
    expect(screen.getByText("billing.invoices.status.failed")).toBeInTheDocument()
    expect(screen.getByText("billing.invoices.status.void")).toBeInTheDocument()
  })

  it("disables download when invoice has not been issued (issuedAt = null)", () => {
    setupLocale()
    useDownloadBillingInvoice.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })

    render(
      <InvoicesTable
        invoices={[
          baseInvoice({ id: "draft-1", invoiceNumber: null, issuedAt: null }),
        ]}
      />,
    )

    const button = screen.getByRole("button", {
      name: "billing.invoices.action.download",
    })
    expect(button).toBeDisabled()
    expect(screen.getByText("billing.invoices.notIssued")).toBeInTheDocument()
  })

  it("triggers the download mutation when the button is clicked", async () => {
    setupLocale()
    const mutate = vi.fn()
    useDownloadBillingInvoice.mockReturnValue({ mutate, isPending: false })

    render(<InvoicesTable invoices={[baseInvoice({ id: "inv-1" })]} />)

    const button = screen.getByRole("button", {
      name: "billing.invoices.action.download",
    })
    await userEvent.click(button)

    expect(mutate).toHaveBeenCalledWith("inv-1")
  })

  it("shows skeleton rows when isLoading is true", () => {
    setupLocale()
    useDownloadBillingInvoice.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })

    const { container } = render(<InvoicesTable invoices={[]} isLoading />)

    expect(container.querySelectorAll("tbody tr")).toHaveLength(5)
  })
})
