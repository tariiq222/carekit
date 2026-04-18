'use client';

import { useReducer, useState, useEffect } from 'react';
import { reduce, INITIAL_WIZARD_STATE, WizardStep } from '@carekit/shared';
import type { Service, EmployeeWithUser, AvailableSlot, GuestClientInfo } from '@carekit/shared';
import { ServicePicker } from '@/features/booking/service-picker';
import { TherapistPicker } from '@/features/booking/therapist-picker';
import { SlotPicker } from '@/features/booking/slot-picker';
import { BookingSummary } from '@/features/booking/booking-summary';
import { OtpRequestForm } from '@/features/otp/otp-request-form';
import { OtpVerifyForm } from '@/features/otp/otp-verify-form';
import { useOtpSession } from '@/features/otp/use-otp-session';
import { getPublicAvailability, createGuestBooking, initGuestPayment } from '@/features/booking/booking.api';
import type { PublicEmployee } from '@carekit/api-client';
import { PaymentRedirect } from '@/features/payment/payment-redirect';

function ProgressBar({ step }: { step: string }) {
  const steps = ['SERVICE', 'THERAPIST', 'SLOT', 'INFO_OTP', 'PAYMENT'];
  const current = steps.indexOf(step);
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
      {steps.map((s, i) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: '4px',
            borderRadius: '2px',
            background: i <= current ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 15%, transparent)',
          }}
        />
      ))}
    </div>
  );
}

export default function BookingWizardPage() {
  const [state, dispatch] = useReducer(reduce, INITIAL_WIZARD_STATE);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithUser[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const { token, storeToken } = useOtpSession();

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100'}/public/employees`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        const emps = (json.data ?? json) as PublicEmployee[];
        setEmployees(emps as unknown as EmployeeWithUser[]);
      })
      .catch(() => {});
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100'}/public/catalog`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        const svcs = (json.data ?? json).services as Service[];
        setServices(svcs ?? []);
      })
      .catch(() => {});
  }, []);

  const service = state.step === WizardStep.THERAPIST || state.step === WizardStep.SLOT
    || state.step === WizardStep.INFO_OTP || state.step === WizardStep.PAYMENT
    ? state.service : null;
  const employee = state.step === WizardStep.SLOT || state.step === WizardStep.INFO_OTP
    || state.step === WizardStep.PAYMENT ? state.employee : null;
  const slot = state.step === WizardStep.INFO_OTP || state.step === WizardStep.PAYMENT ? state.slot : null;

  useEffect(() => {
    if (state.step === WizardStep.SLOT && employee) {
      setLoadingSlots(true);
      getPublicAvailability(employee.id, selectedDate, service?.id)
        .then(setSlots)
        .catch(() => setSlots([]))
        .finally(() => setLoadingSlots(false));
    }
  }, [state.step, employee, selectedDate, service]);

  if (redirectUrl && bookingId) {
    return <PaymentRedirect redirectUrl={redirectUrl} bookingId={bookingId} />;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem' }}>
      <ProgressBar step={state.step} />

      {submitError && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'color-mix(in srgb, var(--destructive) 10%, transparent)', borderRadius: 'var(--radius)', color: 'var(--destructive)', fontSize: '0.875rem' }}>
          {submitError}
        </div>
      )}

      {state.step === WizardStep.SERVICE && (
        <ServicePicker
          services={services}
          selected={null}
          onSelect={(svc) => dispatch({ type: 'SELECT_SERVICE', service: svc })}
        />
      )}

      {state.step === WizardStep.THERAPIST && service && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            style={{ background: 'transparent', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', cursor: 'pointer', alignSelf: 'start' }}
          >
            Back
          </button>
          <TherapistPicker
            therapists={employees}
            selected={null}
            onSelect={(emp) => dispatch({ type: 'SELECT_EMPLOYEE', employee: emp })}
          />
        </div>
      )}

      {state.step === WizardStep.SLOT && service && employee && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={() => dispatch({ type: 'SELECT_EMPLOYEE', employee })}
            style={{ background: 'transparent', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', cursor: 'pointer', alignSelf: 'start' }}
          >
            Back
          </button>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ padding: '0.5rem', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', borderRadius: 'var(--radius)' }}
            />
          </div>
          <SlotPicker
            slots={slots}
            selected={null}
            onSelect={(s) => dispatch({ type: 'SELECT_SLOT', slot: s })}
            isLoading={loadingSlots}
          />
        </div>
      )}

      {state.step === WizardStep.INFO_OTP && service && employee && slot && (
        <ClientInfoStep
          slot={slot}
          onBack={() => dispatch({ type: 'SELECT_SLOT', slot })}
          onSubmitInfo={async (client) => {
            if (!token) return;
            setIsSubmitting(true);
            setSubmitError(null);
            try {
              const booking = await createGuestBooking(
                {
                  serviceId: service.id,
                  employeeId: employee.id,
                  branchId: '',
                  startsAt: slot.startTime,
                  client,
                },
                token,
              );
              const payment = await initGuestPayment(booking.bookingId, token);
              setBookingId(booking.bookingId);
              setRedirectUrl(payment.redirectUrl);
            } catch (err) {
              setSubmitError(err instanceof Error ? err.message : 'Booking failed');
            } finally {
              setIsSubmitting(false);
            }
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {state.step === WizardStep.PAYMENT && service && employee && slot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={() => dispatch({ type: 'SELECT_SLOT', slot })}
            style={{ background: 'transparent', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', cursor: 'pointer', alignSelf: 'start' }}
          >
            Back
          </button>
          <BookingSummary
            service={service}
            employee={employee}
            slot={slot}
            totalHalalat={Number(service.price)}
            onConfirm={() => {}}
            isSubmitting={false}
          />
        </div>
      )}

      {state.step === WizardStep.CONFIRMATION && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          {state.status === 'success' ? (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Booking Confirmed!</h2>
              <p style={{ opacity: 0.7, marginBottom: '2rem' }}>You will receive a confirmation email shortly.</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Payment Failed</h2>
              <p style={{ opacity: 0.7, marginBottom: '2rem' }}>Your booking was not confirmed. Please try again.</p>
            </>
          )}
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
          >
            {state.status === 'success' ? 'Book Another' : 'Try Again'}
          </button>
        </div>
      )}
    </div>
  );
}

function ClientInfoStep({
  slot,
  onBack,
  onSubmitInfo,
  isSubmitting,
}: {
  slot: AvailableSlot;
  onBack: () => void;
  onSubmitInfo: (client: GuestClientInfo) => void;
  isSubmitting: boolean;
}) {
  const [client, setClient] = useState<GuestClientInfo>({ name: '', phone: '', email: '' });
  const [otpStep, setOtpStep] = useState<'form' | 'request' | 'verify'>('form');
  const { token, storeToken } = useOtpSession();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button
        onClick={onBack}
        style={{ background: 'transparent', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', cursor: 'pointer', alignSelf: 'start' }}
      >
        Back
      </button>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Full Name</label>
          <input type="text" value={client.name} onChange={(e) => setClient(c => ({ ...c, name: e.target.value }))}
            style={{ padding: '0.75rem', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', borderRadius: 'var(--radius)', width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Phone</label>
          <input type="tel" value={client.phone} onChange={(e) => setClient(c => ({ ...c, phone: e.target.value }))}
            placeholder="+966..." style={{ padding: '0.75rem', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', borderRadius: 'var(--radius)', width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Email</label>
          <input type="email" value={client.email} onChange={(e) => setClient(c => ({ ...c, email: e.target.value }))}
            style={{ padding: '0.75rem', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', borderRadius: 'var(--radius)', width: '100%' }} />
        </div>
      </div>

      {otpStep === 'request' && (
        <OtpRequestForm client={client} hcaptchaToken="dummy-token" onRequestSent={() => setOtpStep('verify')} />
      )}

      {otpStep === 'verify' && (
        <OtpVerifyForm client={client} onVerified={(t) => { storeToken(t); setOtpStep('form'); }} />
      )}

      {otpStep === 'form' && !token && (
        <button onClick={() => setOtpStep('request')} style={{ padding: '0.875rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}>
          Verify Email to Continue
        </button>
      )}

      {otpStep === 'form' && token && (
        <button
          onClick={() => onSubmitInfo(client)}
          disabled={isSubmitting || !client.name || !client.phone || !client.email}
          style={{
            padding: '0.875rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600,
            cursor: isSubmitting || !client.name || !client.phone || !client.email ? 'not-allowed' : 'pointer',
            opacity: isSubmitting || !client.name || !client.phone || !client.email ? 0.6 : 1,
          }}
        >
          {isSubmitting ? 'Processing...' : 'Continue to Payment'}
        </button>
      )}
    </div>
  );
}