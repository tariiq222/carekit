import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { UseFormReturn } from "react-hook-form"
import type { CreateGroupFormValues } from "@/lib/schemas/groups.schema"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "ar", t: (k: string) => k }),
}))

import { GeneralInfoTab } from "@/components/features/groups/create/general-info-tab"

function mockForm(): UseFormReturn<CreateGroupFormValues> {
  return {
    register: vi.fn().mockReturnValue({}),
    watch: vi.fn(),
    setValue: vi.fn(),
    formState: {
      errors: {},
    },
  } as unknown as UseFormReturn<CreateGroupFormValues>
}

describe("GeneralInfoTab", () => {
  let form: ReturnType<typeof mockForm>

  beforeEach(() => {
    form = mockForm()
  })

  it("renders all 6 fields: nameAr, nameEn, descAr, descEn, minParticipants, maxParticipants", () => {
    render(<GeneralInfoTab form={form} />)

    // Names — AR primary (locale=ar)
    expect(screen.getByText(/groups.create.nameAr/i)).toBeInTheDocument()
    expect(screen.getByText(/groups.create.nameEn/i)).toBeInTheDocument()

    // Descriptions
    expect(screen.getByText(/groups.create.descAr/i)).toBeInTheDocument()
    expect(screen.getByText(/groups.create.descEn/i)).toBeInTheDocument()

    // Capacity
    expect(screen.getByText(/groups.create.minParticipants/i)).toBeInTheDocument()
    expect(screen.getByText(/groups.create.maxParticipants/i)).toBeInTheDocument()
  })

  it("minParticipants and maxParticipants are number inputs", () => {
    render(<GeneralInfoTab form={form} />)

    const numberInputs = screen.getAllByRole("spinbutton")
    expect(numberInputs).toHaveLength(2)
  })

  it("shows required field labels with asterisk", () => {
    render(<GeneralInfoTab form={form} />)

    // Primary name field should be marked required
    expect(screen.getByText(/groups.create.nameAr/i)?.closest("div")?.textContent).toContain("*")
  })

  it("renders error message when nameAr is missing", () => {
    const formWithError = {
      ...mockForm(),
      formState: {
        errors: {
          nameAr: { message: "مطلوب" },
        },
      },
    } as unknown as UseFormReturn<CreateGroupFormValues>

    render(<GeneralInfoTab form={formWithError} />)

    expect(screen.getByText(/مطلوب/i)).toBeInTheDocument()
  })

  it("renders error message when minParticipants exceeds maxParticipants", () => {
    const formWithError = {
      ...mockForm(),
      formState: {
        errors: {
          minParticipants: { message: "الحد الأدنى لا يمكن أن يتجاوز الحد الأقصى" },
        },
      },
    } as unknown as UseFormReturn<CreateGroupFormValues>

    render(<GeneralInfoTab form={formWithError} />)

    expect(screen.getByText(/الحد الأدنى لا يمكن أن يتجاوز الحد الأقصى/i)).toBeInTheDocument()
  })
})
