import { ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { renderWithQuery } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

const login = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    login: (payload: { password: string }) => login(payload),
  },
}));

// Imported after the mocks so LoginPage picks them up.
const { LoginPage } = await import("@/pages/login");

async function submit(password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Enter" }));
}

describe("LoginPage", () => {
  it("sends the typed password, caches the session, and navigates home", async () => {
    const session = { authenticated: true, image_base: "", bf_name: "A", gf_name: "B" };
    login.mockResolvedValue(session);
    const { client } = renderWithQuery(<LoginPage />);
    const setQueryData = vi.spyOn(client, "setQueryData");

    await submit("hunter2");

    await waitFor(() => expect(login).toHaveBeenCalledWith({ password: "hunter2" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
    // The route guard on "/" reads this cache entry, so it must already hold
    // the signed-in session when the navigation starts.
    expect(setQueryData).toHaveBeenCalledWith(queryKeys.session, session);
    expect(setQueryData.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0],
    );
  });

  it("shows an error and stays put when the password is wrong", async () => {
    login.mockRejectedValue(new ApiError(401, "invalid password"));
    renderWithQuery(<LoginPage />);

    await submit("wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid password");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows the backend's message when there were too many attempts", async () => {
    login.mockRejectedValue(new ApiError(429, "too many attempts, try again in 5 minutes"));
    renderWithQuery(<LoginPage />);

    await submit("wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "too many attempts, try again in 5 minutes",
    );
  });

  it("does not blame the password for a server or network failure", async () => {
    login.mockRejectedValue(new ApiError(500, "internal server error"));
    renderWithQuery(<LoginPage />);

    await submit("hunter2");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign in. Try again.");
  });

  it("does not submit an empty password", async () => {
    const user = userEvent.setup();
    renderWithQuery(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Enter" }));

    expect(login).not.toHaveBeenCalled();
  });
});
