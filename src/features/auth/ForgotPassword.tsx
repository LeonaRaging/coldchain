import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resetPassword, confirmResetPassword } from "aws-amplify/auth";
import AuthBrand from "./AuthBrand";

type AuthError = { name?: string; message?: string };

function describeError(err: unknown, fallback: string): string {
    const e = err as AuthError;
    return `${e.name ?? "Error"}: ${e.message ?? fallback}`;
}

function getSendCodeError(err: unknown): string {
    const e = err as AuthError;

    switch (e.name) {
        case "InvalidParameterException":
            return "We cannot send a reset code because this account's email is not verified. Confirm your email first.";
        case "UserNotFoundException":
            return "Username does not exist. Check the username and try again.";
        case "LimitExceededException":
        case "TooManyRequestsException":
            return "Too many attempts. Wait a few minutes and try again.";
        case "NetworkError":
            return "Cannot reach the server. Check your internet connection.";
        default:
            return describeError(err, "Could not send the code.");
    }
}

function getResetError(err: unknown): string {
    const e = err as AuthError;

    switch (e.name) {
        case "CodeMismatchException":
            return "Wrong confirmation code. Check your email and try again.";
        case "ExpiredCodeException":
            return "This code has expired. Request a new code.";
        case "InvalidPasswordException":
            return `Password does not meet the requirements. ${e.message ?? ""}`;
        case "UserNotFoundException":
            return "Username does not exist.";
        case "LimitExceededException":
        case "TooManyRequestsException":
            return "Too many attempts. Wait a few minutes and try again.";
        default:
            return describeError(err, "Could not reset the password.");
    }
}

const NO_CONFIRM_BUTTON = [
    "UserNotFoundException",
    "LimitExceededException",
    "TooManyRequestsException",
    "NetworkError",
];

export default function ForgotPassword() {
    const navigate = useNavigate();
    const location = useLocation();

    const [username, setUsername] = useState(
        (location.state as { username?: string } | null)?.username ?? ""
    );
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [showConfirmEmail, setShowConfirmEmail] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [loading, setLoading] = useState(false);

    function goToConfirmEmail() {
        navigate("/register", { state: { username, needsConfirmation: true } });
    }

    async function handleSendCode(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setInfo("");
        setShowConfirmEmail(false);
        setLoading(true);

        try {
            await resetPassword({ username: username.trim() });
            setInfo("We sent a code to your email.");
            setCodeSent(true);
        } catch (err) {
            console.error(err);
            const e = err as AuthError;
            setError(getSendCodeError(err));
            setShowConfirmEmail(!NO_CONFIRM_BUTTON.includes(e.name ?? ""));
        } finally {
            setLoading(false);
        }
    }

    async function handleResend() {
        setError("");
        setInfo("");
        setLoading(true);

        try {
            await resetPassword({ username: username.trim() });
            setInfo("A new code has been sent to your email.");
        } catch (err) {
            console.error(err);
            setError(getSendCodeError(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleReset(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            await confirmResetPassword({
                username: username.trim(),
                confirmationCode: code.trim(),
                newPassword,
            });
            navigate("/login");
        } catch (err) {
            console.error(err);
            setError(getResetError(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="fixed inset-0 z-10 flex overflow-y-auto bg-motive-surface p-5 text-left font-sans text-sm leading-snug text-motive-ink">
            <section className="m-auto flex w-full max-w-sm flex-col gap-2 rounded-xl border border-motive-line bg-white p-7 shadow-sm">
                <AuthBrand />
                {codeSent ? (
                    <>
                        <h1 className="m-0 mb-1 text-left text-2xl font-semibold leading-tight tracking-tight text-motive-ink">Reset your password</h1>
                        <p className="m-0 text-sm text-motive-muted">
                            {info || "Enter the code we sent to your email."}
                        </p>

                        <form className="mt-2 flex flex-col gap-4" onSubmit={handleReset}>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-motive-ink" htmlFor="code">Confirmation code</label>
                                <input
                                    id="code"
                                    className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                                    type="text"
                                    placeholder="Enter confirmation code"
                                    value={code}
                                    onChange={(event) => setCode(event.target.value)}
                                    autoComplete="one-time-code"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-motive-ink" htmlFor="newPassword">New password</label>
                                <input
                                    id="newPassword"
                                    className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                                    type="password"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </div>

                            {error && <p className="m-0 text-sm text-red-600" role="alert">{error}</p>}

                            <div className="flex flex-col gap-2">
                                <button className="h-10 cursor-pointer rounded-md border-none bg-motive-blue text-sm font-semibold text-white transition-colors enabled:hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                                    {loading ? "Saving..." : "Reset password"}
                                </button>
                                <button
                                    className="h-10 cursor-pointer rounded-md border border-motive-line bg-white text-sm font-semibold text-motive-ink transition-colors enabled:hover:bg-motive-surface disabled:cursor-not-allowed disabled:opacity-60"
                                    type="button"
                                    onClick={handleResend}
                                    disabled={loading}
                                >
                                    Resend code
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <h1 className="m-0 mb-1 text-left text-2xl font-semibold leading-tight tracking-tight text-motive-ink">Forgot your password?</h1>
                        <p className="m-0 text-sm text-motive-muted">We will email you a code to reset it.</p>

                        <form className="mt-2 flex flex-col gap-4" onSubmit={handleSendCode}>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-motive-ink" htmlFor="username">Username</label>
                                <input
                                    id="username"
                                    className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                                    type="text"
                                    placeholder="Enter username"
                                    value={username}
                                    onChange={(event) => {
                                        setUsername(event.target.value);
                                        setError("");
                                        setShowConfirmEmail(false);
                                    }}
                                    autoComplete="username"
                                    required
                                />
                            </div>

                            {error && <p className="m-0 text-sm text-red-600" role="alert">{error}</p>}

                            <div className="flex flex-col gap-2">
                                <button className="h-10 cursor-pointer rounded-md border-none bg-motive-blue text-sm font-semibold text-white transition-colors enabled:hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                                    {loading ? "Sending..." : "Send code"}
                                </button>

                                {showConfirmEmail && (
                                    <button
                                        className="h-10 cursor-pointer rounded-md border border-motive-line bg-white text-sm font-semibold text-motive-ink transition-colors enabled:hover:bg-motive-surface disabled:cursor-not-allowed disabled:opacity-60"
                                        type="button"
                                        onClick={goToConfirmEmail}
                                        disabled={loading}
                                    >
                                        Confirm your email
                                    </button>
                                )}
                            </div>
                        </form>
                    </>
                )}

                <p className="m-0 mt-1 text-center text-sm text-motive-muted">
                    <Link className="text-motive-blue no-underline hover:underline" to="/login">Back to sign in</Link>
                </p>
            </section>
        </main>
    );
}
