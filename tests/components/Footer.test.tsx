/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Footer } from "@/components/Footer";

const toastFn = jest.fn();
const toastSuccessFn = jest.fn();

jest.mock("sonner", () => ({
  toast: Object.assign((message: string) => toastFn(message), {
    success: (message: string) => toastSuccessFn(message),
  }),
}));

describe("Footer", () => {
  beforeEach(() => {
    toastFn.mockClear();
    toastSuccessFn.mockClear();
  });

  it("copies support email to clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<Footer />);

    fireEvent.click(screen.getByText("Support"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("hello@mistystep.io");
      expect(toastSuccessFn).toHaveBeenCalledWith("Email copied to clipboard");
    });
  });

  it("falls back to mailto when clipboard fails", async () => {
    const writeText = jest.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { writeText } });

    render(<Footer />);

    fireEvent.click(screen.getByText("Support"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("hello@mistystep.io");
      expect(toastFn).toHaveBeenCalledWith("Opening your email client...");
    });
  });
});
