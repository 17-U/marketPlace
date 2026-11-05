"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authApi, ApiError } from "@/lib/api-client";
import { saveTokens } from "@/lib/auth-storage";
import { CAMEROON_PHONE_REGEX } from "@marketplace/shared";

type Step = "phone" | "code";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function requestCode() {
    setError(null);

    if (!CAMEROON_PHONE_REGEX.test(phone)) {
      setError(t("errorGeneric"));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.requestOtp(phone);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errorGeneric"));
    } finally {
      setIsLoading(false);
    }
  }

  function handleRequestCode(event: React.FormEvent) {
    event.preventDefault();
    void requestCode();
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await authApi.verifyOtp({
        phone,
        code,
        firstName: isNewAccount ? firstName : undefined,
        lastName: isNewAccount ? lastName : undefined,
      });
      saveTokens(result);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errorGeneric"));
      if (err instanceof ApiError && err.message.includes("Prénom")) {
        setIsNewAccount(true);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold text-clay-900">{t("loginTitle")}</h1>
      <p className="mt-1 text-sm text-clay-600">{t("loginSubtitle")}</p>

      {step === "phone" && (
        <form className="mt-6 space-y-4" onSubmit={handleRequestCode}>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-clay-700">
              {t("phoneLabel")}
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t("phonePlaceholder")}
              className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2 focus:border-brand-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {t("sendCode")}
          </button>
        </form>
      )}

      {step === "code" && (
        <form className="mt-6 space-y-4" onSubmit={handleVerifyCode}>
          <p className="text-sm text-clay-600">{t("codeSubtitle", { phone })}</p>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-clay-700">
              {t("codeLabel")}
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2 tracking-widest focus:border-brand-500 focus:outline-none"
            />
          </div>

          {isNewAccount && (
            <>
              <p className="text-sm text-clay-600">{t("newAccountNotice")}</p>
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-clay-700">
                  {t("firstNameLabel")}
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-clay-700">
                  {t("lastNameLabel")}
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {t("verifyCode")}
          </button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="text-clay-500 hover:text-clay-700"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
            >
              {t("changeNumber")}
            </button>
            <button
              type="button"
              className="text-brand-600 hover:text-brand-700"
              onClick={() => void requestCode()}
            >
              {t("resendCode")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
