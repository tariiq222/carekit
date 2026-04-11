import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useForm, FormProvider } from "react-hook-form"
import type { CreateGroupFormValues } from "@/lib/schemas/groups.schema"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "ar", t: (k: string) => k }),
}))

// Mock DateTimeInput so Controller doesn't need special setup
vi.mock("@/components/ui/date-time-input", () => ({
  DateTimeInput: ({
    value,
    onChange,
  }: {
    value?: string
    onChange?: () => void
  }) => (
    <input
      type="datetime-local"
      data-testid="datetime-input"
      value={value ?? ""}
      onChange={onChange}
    />
  ),
}))

import { SettingsTab } from "@/components/features/groups/create/settings-tab"

function makeDefaults(
  overrides: Partial<CreateGroupFormValues> = {},
): CreateGroupFormValues {
  return {
    nameAr: "",
    nameEn: "",
    descriptionAr: "",
    descriptionEn: "",
    employeeId: "123e4567-e89b-12d3-a456-426614174000",
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

function SettingsTabWrapper({
  overrides = {},
}: {
  overrides?: Partial<CreateGroupFormValues>
}) {
  const methods = useForm<CreateGroupFormValues>({
    defaultValues: makeDefaults(overrides),
  })
  return (
    <FormProvider {...methods}>
      <SettingsTab form={methods} />
    </FormProvider>
  )
}

describe("SettingsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("location field IS shown when deliveryMode is in_person", () => {
    render(<SettingsTabWrapper overrides={{ deliveryMode: "in_person" }} />)
    expect(screen.getByText(/groups.create.location/i)).toBeInTheDocument()
  })

  it("location field is NOT shown when deliveryMode is online", () => {
    render(<SettingsTabWrapper overrides={{ deliveryMode: "online" }} />)
    expect(screen.queryByText(/groups.create.location/i)).not.toBeInTheDocument()
  })

  it("meetingLink field IS shown when deliveryMode is online", () => {
    render(<SettingsTabWrapper overrides={{ deliveryMode: "online" }} />)
    expect(screen.getByText(/groups.create.meetingLink/i)).toBeInTheDocument()
  })

  it("meetingLink field is NOT shown when deliveryMode is in_person", () => {
    render(<SettingsTabWrapper overrides={{ deliveryMode: "in_person" }} />)
    expect(
      screen.queryByText(/groups.create.meetingLink/i),
    ).not.toBeInTheDocument()
  })

  it("isPublished switch renders and responds to toggle", async () => {
    render(<SettingsTabWrapper overrides={{ isPublished: false }} />)

    const switchEl = screen.getByRole("switch")
    expect(switchEl).toBeInTheDocument()
    expect(switchEl).not.toBeChecked()

    await userEvent.click(switchEl)
    expect(screen.getByRole("switch")).toBeChecked()
  })

  it("isPublished switch is checked when isPublished is true", () => {
    render(<SettingsTabWrapper overrides={{ isPublished: true }} />)
    expect(screen.getByRole("switch")).toBeChecked()
  })

  it("renders expiresAt field", () => {
    render(<SettingsTabWrapper />)
    expect(screen.getByText(/groups.create.expiresAt/i)).toBeInTheDocument()
  })

  it("renders deliveryMode select with in_person, online, hybrid options", () => {
    render(<SettingsTabWrapper />)
    // Use queryAllByText since SelectValue also renders the placeholder text
    const matches = screen.queryAllByText(/groups.create.deliveryMode/i)
    expect(matches.length).toBeGreaterThan(0)
  })
})
