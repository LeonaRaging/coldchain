import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resetPassword, confirmResetPassword } from "aws-amplify/auth";
import "./Login.css";

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
            setInfo("If an account with that username exists, a password reset code will be sent to the associated email address.");
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
        <main className="login-page">
            <section className="login-card">
                {codeSent ? (
                    <>
                        <h1>Reset your password</h1>
                        <p className="subtitle">
                            {info || "Enter the code we sent to your email."}
                        </p>

                        <form onSubmit={handleReset}>
                            <div className="field">
                                <label htmlFor="code">Confirmation code</label>
                                <input
                                    id="code"
                                    type="text"
                                    placeholder="Enter confirmation code"
                                    value={code}
                                    onChange={(event) => setCode(event.target.value)}
                                    autoComplete="one-time-code"
                                    required
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="newPassword">New password</label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </div>

                            {error && <p role="alert">{error}</p>}

                            <div className="actions">
                                <button type="submit" disabled={loading}>
                                    {loading ? "Saving..." : "Reset password"}
                                </button>
                                <button
                                    type="button"
                                    className="secondary"
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
                        <h1>Forgot your password?</h1>
                        <p className="subtitle">We will email you a code to reset it.</p>

                        <form onSubmit={handleSendCode}>
                            <div className="field">
                                <label htmlFor="username">Username</label>
                                <input
                                    id="username"
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

                            {error && <p role="alert">{error}</p>}

                            <div className="actions">
                                <button type="submit" disabled={loading}>
                                    {loading ? "Sending..." : "Send code"}
                                </button>

                                {showConfirmEmail && (
                                    <button
                                        type="button"
                                        className="secondary"
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

                <p className="auth-link">
                    <Link to="/login">Back to sign in</Link>
                </p>
            </section>
        </main>
    );
}