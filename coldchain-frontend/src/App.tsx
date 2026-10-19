import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getCurrentUser } from "aws-amplify/auth";
import Login from "./Login";
import ForgotPassword from "./ForgotPassword";
import Register from "./Register";
import TruckMap from "./TruckMap";

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
        return <p>Loading...</p>;
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
                    element={signedIn ? <TruckMap /> : <Navigate to="/login" replace />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}