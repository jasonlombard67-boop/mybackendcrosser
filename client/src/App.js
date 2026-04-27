import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage    from "./pages/LoginPage";
import ContinuePage from "./pages/ContinuePage";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<LoginPage />}    />
        <Route path="/continue" element={<ContinuePage />} />
      </Routes>
    </BrowserRouter>
  );
}
