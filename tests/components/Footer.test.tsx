/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Footer } from "@/components/Footer";

const toastFn = jest.fn();
const toastSuccessFn = jest.fn();
let writeTextSpy: jest.SpyInstance | undefined;

jest.mock("sonner", () => ({
  toast: Object.assign((message: string) => toastFn(message), {
    success: (message: string) => toastSuccessFn(message),
  }),
}));

describe("Footer", () => {
  beforeEach(() => {
    toastFn.mockClear();
    toastSuccessFn.mockClear();
    writeTextSpy?.mockRestore();

    if (!navigator.clipboard) {
      // jsdom may not define clipboard; create a minimal mock shape
      Object.assign(navigator, { clipboard: { writeText: async () => {} } });
    }
  });

  it("copies support email to clipboard", async () => {
    writeTextSpy = jest
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    render(<Footer />);

    fireEvent.click(screen.getByText("Support"));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith("hello@mistystep.io");
      expect(toastSuccessFn).toHaveBeenCalledWith("Email copied to clipboard");
    });
  });

  it("falls back to mailto when clipboard fails", async () => {
    writeTextSpy = jest
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValue(new Error("denied"));

    render(<Footer />);

    fireEvent.click(screen.getByText("Support"));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith("hello@mistystep.io");
      expect(toastFn).toHaveBeenCalledWith("Opening your email client...");
    });
  });
});
