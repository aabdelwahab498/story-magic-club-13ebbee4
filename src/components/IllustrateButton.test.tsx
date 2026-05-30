// Integration tests for the AIStoryteller "Illustrate" button.
//
// Verifies:
//   - Disabled while a generation is in flight (illustrating=true).
//   - Disabled once images are ready (count>0).
//   - Enabled when idle with no images.
//   - Readiness badge text + data-count reflect the live count.
//   - Click handler fires once per user click (no auto-trigger).
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import IllustrateButton from "./IllustrateButton";

const t = ((_: string, d?: string) => d ?? _) as unknown as Parameters<
  typeof IllustrateButton
>[0]["t"];

describe("IllustrateButton — enabled/disabled state + readiness badge", () => {
  it("is enabled when idle with no images, badge says 'Tap to generate'", () => {
    render(<IllustrateButton count={0} illustrating={false} t={t} onClick={() => {}} />);
    const btn = screen.getByTestId("ai-illustrate-button");
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute("data-ready", "false");
    expect(btn).toHaveAttribute("data-count", "0");
    expect(btn.textContent).toMatch(/Illustrate/);
    const badge = screen.getByTestId("ai-illustration-readiness-badge");
    expect(badge).toHaveAttribute("data-count", "0");
    expect(badge.textContent).toMatch(/Tap to generate/);
  });

  it("is disabled while generation is in flight, badge says 'Generating'", () => {
    render(<IllustrateButton count={0} illustrating={true} t={t} onClick={() => {}} />);
    const btn = screen.getByTestId("ai-illustrate-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("data-illustrating", "true");
    expect(screen.getByTestId("ai-illustration-readiness-badge").textContent).toMatch(
      /Generating/,
    );
  });

  it("flips to 'Illustrations ready' and disables once count>0", () => {
    const { rerender } = render(
      <IllustrateButton count={0} illustrating={true} t={t} onClick={() => {}} />,
    );
    // Simulate generation finishing with 3 images available.
    rerender(
      <IllustrateButton count={3} illustrating={false} t={t} onClick={() => {}} />,
    );
    const btn = screen.getByTestId("ai-illustrate-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("data-ready", "true");
    expect(btn).toHaveAttribute("data-count", "3");
    expect(btn.textContent).toMatch(/Illustrations ready/);
    const badge = screen.getByTestId("ai-illustration-readiness-badge");
    expect(badge).toHaveAttribute("data-count", "3");
    expect(badge.textContent).toMatch(/3 images ready/);
  });

  it("only fires onClick from a real user click (no auto-trigger)", () => {
    const onClick = vi.fn();
    render(<IllustrateButton count={0} illustrating={false} t={t} onClick={onClick} />);
    // No automatic call on mount — Function B contract.
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("ai-illustrate-button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores clicks when disabled (illustrating)", () => {
    const onClick = vi.fn();
    render(<IllustrateButton count={0} illustrating={true} t={t} onClick={onClick} />);
    fireEvent.click(screen.getByTestId("ai-illustrate-button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ignores clicks when disabled (already ready)", () => {
    const onClick = vi.fn();
    render(<IllustrateButton count={2} illustrating={false} t={t} onClick={onClick} />);
    fireEvent.click(screen.getByTestId("ai-illustrate-button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
