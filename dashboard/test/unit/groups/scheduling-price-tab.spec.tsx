import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import type { CreateGroupFormValues } from "@/lib/schemas/groups.schema"
import { useForm, FormProvider } from "react-hook-form"
import type { ReactNode } from "react"
import { useEffect } from "react"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "ar", t: (k: string) => k }),
}))

// Mock DateTimeInput so Controller doesn't need a real control object
vi.mock("@/components/ui/date-time-input", () => ({
  DateTimeInput: ({ error, value, onChange }: { error?: boolean; value?: string; onChange?: () => void }) => (
    <input type="datetime-local" data-testid="datetime-input" data-error={error} value={value ?? ""} onChange={onChange} />
  ),
}))

import { SchedulingPriceTab } from "@/components/features/groups/create/scheduling-price-tab"

function makeFormValues(overrides: Partial<CreateGroupFormValues> = {}): CreateGroupFormValues {
  return {
    nameAr: "",
    nameEn: "",
    descriptionAr: "",
    descriptionEn: "",
    practitionerId: "123e4567-e89b-12d3-a456-426614174000",
    minParticipants: 2,
    maxParticipants: 10,
    pricePerPersonHalalat: 0,
    durationMinutes: 60,
    paymentDeadlineHours: 48,
    paymentType: "FULL_PAYMENT",
    depositAmount: undefined,
    remainingDueDate: undefined,
    schedulingMode: "fixed_date",
    startTime: undefined,
    endDate: undefined,
    deliveryMode: "in_person",
    location: undefined,
    meetingLink: undefined,
    isPublished: false,
    expiresAt: undefined,
    ...overrides,
  }
}

// Wraps SchedulingPriceTab with a real useForm instance
function SchedulingPriceTabWrapper({
  overrides = {},
  errorField,
  errorMessage,
}: {
  overrides?: Partial<CreateGroupFormValues>
  errorField?: keyof CreateGroupFormValues
  errorMessage?: string
}) {
  const methods = useForm<CreateGroupFormValues>({ defaultValues: makeFormValues(overrides) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (errorField && errorMessage) {
      methods.setError(errorField, { message: errorMessage })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <FormProvider {...methods}>
      <SchedulingPriceTab form={methods} />
    </FormProvider>
  )
}

describe("SchedulingPriceTab", () => {
  it("depositAmount field is NOT shown when paymentType is FULL_PAYMENT", () => {
    render(<SchedulingPriceTabWrapper overrides={{ paymentType: "FULL_PAYMENT" }} />)
    expect(screen.queryByText(/groups.create.depositAmount/i)).not.toBeInTheDocument()
  })

  it("depositAmount field IS shown when paymentType is DEPOSIT", () => {
    render(<SchedulingPriceTabWrapper overrides={{ paymentType: "DEPOSIT" }} />)
    expect(screen.getByText(/groups.create.depositAmount/i)).toBeInTheDocument()
  })

  it("remainingDueDate field IS shown when paymentType is DEPOSIT", () => {
    render(<SchedulingPriceTabWrapper overrides={{ paymentType: "DEPOSIT" }} />)
    expect(screen.getByText(/groups.create.remainingDueDate/i)).toBeInTheDocument()
  })

  it("remainingDueDate field is NOT shown when paymentType is FULL_PAYMENT", () => {
    render(<SchedulingPriceTabWrapper overrides={{ paymentType: "FULL_PAYMENT" }} />)
    expect(screen.queryByText(/groups.create.remainingDueDate/i)).not.toBeInTheDocument()
  })

  it("startTime field IS shown when schedulingMode is fixed_date", () => {
    render(<SchedulingPriceTabWrapper overrides={{ schedulingMode: "fixed_date" }} />)
    expect(screen.getByText(/groups.create.startTime/i)).toBeInTheDocument()
  })

  it("startTime field is NOT shown when schedulingMode is on_capacity", () => {
    render(<SchedulingPriceTabWrapper overrides={{ schedulingMode: "on_capacity" }} />)
    expect(screen.queryByText(/groups.create.startTime/i)).not.toBeInTheDocument()
  })

  it("endDate field IS shown", () => {
    render(<SchedulingPriceTabWrapper />)
    expect(screen.getByText(/groups.create.endDate/i)).toBeInTheDocument()
  })

  it("renders durationMinutes and pricePerPersonHalalat as number inputs", () => {
    render(<SchedulingPriceTabWrapper />)
    const numberInputs = screen.getAllByRole("spinbutton")
    expect(numberInputs.length).toBeGreaterThanOrEqual(2)
  })

  it("renders error when depositAmount is missing with DEPOSIT paymentType", () => {
    render(
      <SchedulingPriceTabWrapper
        overrides={{ paymentType: "DEPOSIT" }}
        errorField="depositAmount"
        errorMessage="مبلغ العربون مطلوب عند اختيار نوع الدفع عربون"
      />,
    )
    expect(screen.getByText(/مبلغ العربون مطلوب/i)).toBeInTheDocument()
  })

  it("renders error when startTime is missing with fixed_date schedulingMode", () => {
    render(
      <SchedulingPriceTabWrapper
        overrides={{ schedulingMode: "fixed_date" }}
        errorField="startTime"
        errorMessage="تاريخ البدء مطلوب عند تحديد تاريخ"
      />,
    )
    expect(screen.getByText(/تاريخ البدء مطلوب/i)).toBeInTheDocument()
  })
})
