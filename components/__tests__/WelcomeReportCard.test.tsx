/**
 * @jest-environment jsdom
 */

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { WelcomeReportCard } from "../WelcomeReportCard";

describe("WelcomeReportCard", () => {
  it("renders nothing when status is completed", () => {
    // Arrange
    const { container } = render(<WelcomeReportCard status="completed" />);

    // Act
    const card = container.firstChild;

    // Assert
    expect(card).toBeNull();
  });

  it("renders nothing when status is undefined", () => {
    // Arrange
    const { container } = render(<WelcomeReportCard status={undefined} />);

    // Act
    const card = container.firstChild;

    // Assert
    expect(card).toBeNull();
  });

  it("shows spinner and generating message when status is generating", () => {
    // Arrange
    const { container } = render(<WelcomeReportCard status="generating" />);

    // Act
    const message = screen.getByText("Generating your first report...");
    const spinner = container.querySelector(".animate-spin");

    // Assert
    expect(message).toBeInTheDocument();
    expect(spinner).toBeTruthy();
  });

  it("shows pending message when status is pending", () => {
    // Arrange
    render(<WelcomeReportCard status="pending" />);

    // Act
    const message = screen.getByText("Setting up your reports...");

    // Assert
    expect(message).toBeInTheDocument();
  });

  it("shows error message and Retry button when status is failed", () => {
    // Arrange
    render(<WelcomeReportCard status="failed" onRetry={jest.fn()} />);

    // Act
    const message = screen.getByText("Unable to generate report. Try again.");
    const button = screen.getByRole("button", { name: "Retry" });

    // Assert
    expect(message).toBeInTheDocument();
    expect(button).toBeInTheDocument();
  });

  it("calls onRetry callback when Retry button is clicked", () => {
    // Arrange
    const onRetry = jest.fn();
    render(<WelcomeReportCard status="failed" onRetry={onRetry} />);
    const button = screen.getByRole("button", { name: "Retry" });

    // Act
    fireEvent.click(button);

    // Assert
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables Retry button when isRetrying is true", () => {
    // Arrange
    render(
      <WelcomeReportCard status="failed" onRetry={jest.fn()} isRetrying />,
    );
    const button = screen.getByRole("button", { name: "Retry" });

    // Act
    const disabled = button.hasAttribute("disabled");

    // Assert
    expect(disabled).toBe(true);
  });
});
