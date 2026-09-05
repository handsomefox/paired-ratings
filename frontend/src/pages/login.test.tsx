import { renderWithQuery } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

const login = vi.fn();
const session = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    login: (payload: { password: string }) => login(payload),
    session: () => session(),
  },
}));

// Imported after the mocks so LoginPage picks them up.
const { LoginPage } = await import("@/pages/login");

describe("LoginPage", () => {
  beforeEach(() => {
    session.mockResolvedValue({ authenticated: false });
  });

  it("sends the typed password and navigates home", async () => {
    login.mockResolvedValue({ authenticated: true });
    const user = userEvent.setup();
    renderWithQuery(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Enter" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ password: "hunter2" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
  });

  it("shows an error and stays put when the password is wrong", async () => {
    login.mockRejectedValue(new Error("unauthorized"));
    const user = userEvent.setup();
    renderWithQuery(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Enter" }));

    expect(await screen.findByText("Invalid password")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not submit an empty password", async () => {
    const user = userEvent.setup();
    renderWithQuery(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Enter" }));

    expect(login).not.toHaveBeenCalled();
  });
});
