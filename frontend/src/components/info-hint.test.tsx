import { InfoHint } from "@/components/info-hint";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const renderHint = () => {
  render(<InfoHint label="About this">It refreshes things.</InfoHint>);
  return screen.getByRole("button", { name: "About this" });
};

// jsdom's click events carry no pointerType, so the test sets one.
const clickAs = (button: HTMLElement, pointerType: string) => {
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  Object.defineProperty(click, "pointerType", { value: pointerType });
  fireEvent(button, click);
};

describe("InfoHint", () => {
  // Safari on iOS reports a tap's click as a mouse click. The pointerdown
  // before it still says "touch", and that is what decides.
  it("opens on a tap even when the click claims to be a mouse", () => {
    const button = renderHint();

    fireEvent.pointerDown(button, { pointerType: "touch" });
    clickAs(button, "mouse");

    expect(button).toHaveAttribute("data-state", "open");

    fireEvent.pointerDown(button, { pointerType: "touch" });
    clickAs(button, "mouse");

    expect(button).toHaveAttribute("data-state", "closed");
  });

  it("stays open when a mouse clicks after hovering opened it", () => {
    const button = renderHint();

    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(button).toHaveAttribute("data-state", "open");

    fireEvent.pointerDown(button, { pointerType: "mouse" });
    clickAs(button, "mouse");

    expect(button).toHaveAttribute("data-state", "open");
  });

  it("forgets a mouse press that left the button before a later keypress", () => {
    const button = renderHint();

    fireEvent.pointerDown(button, { pointerType: "mouse" });
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    clickAs(button, "");

    expect(button).toHaveAttribute("data-state", "open");
  });

  it("opens from the keyboard, which presses no pointer", () => {
    const button = renderHint();

    clickAs(button, "");

    expect(button).toHaveAttribute("data-state", "open");
  });
});
