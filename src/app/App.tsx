import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getCurrentUser } from "aws-amplify/auth";
import Login from "../features/auth/Login";
import ForgotPassword from "../features/auth/ForgotPassword";
import Register from "../features/auth/Register";
import TruckMap from "../features/fleet/TruckMap";

export default function App() {
    const [signedIn, setSignedIn] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        getCurrentUser()
            .then(() => setSignedIn(true))
            .catch(() => setSignedIn(false))
            .finally(() => setCheckingAuth(false));
    }, []);

    if (checkingAuth) {
        return (
            <div className="grid min-h-svh place-items-center bg-motive-surface">
                <div className="flex items-center gap-2 text-sm text-motive-muted">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-motive-blue/25 border-t-motive-blue" />
                    Loading…
                </div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/login"
                    element={
                        signedIn ? (
                            <Navigate to="/" replace />
                        ) : (
                            <Login onSignedIn={() => setSignedIn(true)} />
                        )
                    }
                />
                <Route
                    path="/forgot-password"
                    element={signedIn ? <Navigate to="/" replace /> : <ForgotPassword />}
                />
                <Route
                    path="/register"
                    element={signedIn ? <Navigate to="/" replace /> : <Register />}
                />
                <Route
                    path="/"
                    element={
                        signedIn ? (
                            <TruckMap onSignedOut={() => setSignedIn(false)} />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}