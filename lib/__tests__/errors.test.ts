/**
 * Tests for error handling utilities
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  classifyError,
  getErrorMessage,
  handleConvexError,
  showSuccess,
  showLoading,
  dismissLoading,
  withErrorHandling,
} from "../errors";

// Mock the sonner toast library
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(() => "toast-id"),
    dismiss: jest.fn(),
  },
}));

describe("error utilities", () => {
  describe("classifyError", () => {
    describe("transient errors", () => {
      it("classifies network errors as transient", () => {
        expect(classifyError(new Error("Network failure"))).toBe("transient");
      });

      it("classifies timeout errors as transient", () => {
        expect(classifyError(new Error("Request timeout"))).toBe("transient");
      });

      it("classifies rate limit errors as transient", () => {
        expect(classifyError(new Error("Rate limit exceeded"))).toBe("transient");
      });

      it("classifies unavailable errors as transient", () => {
        expect(classifyError(new Error("Service unavailable"))).toBe("transient");
      });

      it("classifies API errors as transient", () => {
        expect(classifyError(new Error("API error"))).toBe("transient");
      });

      it("classifies service errors as transient", () => {
        expect(classifyError(new Error("Service error"))).toBe("transient");
      });
    });

    describe("auth errors", () => {
      it("classifies not authenticated errors as auth", () => {
        expect(classifyError(new Error("Not authenticated"))).toBe("auth");
      });

      it("classifies unauthorized errors as auth", () => {
        expect(classifyError(new Error("Unauthorized access"))).toBe("auth");
      });

      it("classifies token errors as auth", () => {
        expect(classifyError(new Error("Invalid token"))).toBe("auth");
      });

      it("classifies permission errors as auth", () => {
        expect(classifyError(new Error("Permission denied"))).toBe("auth");
      });
    });

    describe("validation errors", () => {
      it("classifies invalid input as validation", () => {
        expect(classifyError(new Error("Invalid input"))).toBe("validation");
      });

      it("classifies required field errors as validation", () => {
        expect(classifyError(new Error("Field required"))).toBe("validation");
      });

      it("classifies format errors as validation", () => {
        expect(classifyError(new Error("Invalid format"))).toBe("validation");
      });

      it("classifies validation errors as validation", () => {
        expect(classifyError(new Error("Validation failed"))).toBe("validation");
      });
    });

    describe("permanent errors", () => {
      it("classifies unknown errors as permanent", () => {
        expect(classifyError(new Error("Something went wrong"))).toBe("permanent");
      });

      it("classifies database errors as permanent", () => {
        expect(classifyError(new Error("Database connection failed"))).toBe(
          "permanent",
        );
      });
    });
  });

  describe("getErrorMessage", () => {
    it("returns friendly message for auth errors", () => {
      const message = getErrorMessage(new Error("Not authenticated"));
      expect(message).toBe("Please sign in to continue");
    });

    it("returns friendly message for unauthorized", () => {
      const message = getErrorMessage(new Error("Unauthorized"));
      expect(message).toBe("You don't have permission to perform this action");
    });

    it("returns friendly message for rate limit", () => {
      const message = getErrorMessage(new Error("Rate limit exceeded"));
      expect(message).toBe("Too many requests. Please wait a moment and try again");
    });

    it("returns friendly message for not found", () => {
      const message = getErrorMessage(new Error("Not found"));
      expect(message).toBe("The requested resource was not found");
    });

    it("returns friendly message for GitHub API errors", () => {
      const message = getErrorMessage(new Error("GitHub API error"));
      expect(message).toBe(
        "Unable to connect to GitHub. Please try again later",
      );
    });

    it("returns friendly message for Google API errors", () => {
      const message = getErrorMessage(new Error("Google API error"));
      expect(message).toBe("AI service unavailable. Please try again later");
    });

    it("returns friendly message for database errors", () => {
      const message = getErrorMessage(new Error("Database connection failed"));
      expect(message).toBe("A database error occurred. Please try again");
    });

    it("returns default message for unknown errors", () => {
      const message = getErrorMessage(new Error("Some random error"));
      expect(message).toBe("An unexpected error occurred. Please try again");
    });

    it("returns friendly message for invalid token", () => {
      const message = getErrorMessage(new Error("Invalid token"));
      expect(message).toBe("Your session has expired. Please sign in again");
    });

    it("returns friendly message for invalid input", () => {
      const message = getErrorMessage(new Error("Invalid input"));
      expect(message).toBe("Please check your input and try again");
    });

    it("returns friendly message for conflict errors", () => {
      const message = getErrorMessage(new Error("Conflict"));
      expect(message).toBe("This operation conflicts with existing data");
    });
  });

  describe("handleConvexError", () => {
    const { toast } = require("sonner");

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("shows toast for transient errors", () => {
      const result = handleConvexError(new Error("Network error"));
      expect(result).toBe("transient");
      expect(toast.error).toHaveBeenCalled();
    });

    it("shows toast for auth errors", () => {
      const result = handleConvexError(new Error("Not authenticated"));
      expect(result).toBe("auth");
      expect(toast.error).toHaveBeenCalled();
    });

    it("shows toast for validation errors", () => {
      const result = handleConvexError(new Error("Invalid input"));
      expect(result).toBe("validation");
      expect(toast.error).toHaveBeenCalled();
    });

    it("shows toast for permanent errors", () => {
      const result = handleConvexError(new Error("Unknown error"));
      expect(result).toBe("permanent");
      expect(toast.error).toHaveBeenCalled();
    });

    it("includes retry action for transient errors with retry callback", () => {
      const retry = jest.fn();
      handleConvexError(new Error("Network error"), { retry });
      expect(toast.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: expect.objectContaining({ label: "Retry" }),
        })
      );
    });

    it("includes operation in permanent error description", () => {
      handleConvexError(new Error("Unknown error"), { operation: "save data" });
      expect(toast.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: "Failed to save data",
        })
      );
    });
  });

  describe("showSuccess", () => {
    const { toast } = require("sonner");

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("shows success toast", () => {
      showSuccess("Done!");
      expect(toast.success).toHaveBeenCalledWith("Done!", { description: undefined });
    });

    it("shows success toast with description", () => {
      showSuccess("Done!", "Operation completed");
      expect(toast.success).toHaveBeenCalledWith("Done!", { description: "Operation completed" });
    });
  });

  describe("showLoading", () => {
    const { toast } = require("sonner");

    it("shows loading toast and returns id", () => {
      const id = showLoading("Loading...");
      expect(toast.loading).toHaveBeenCalledWith("Loading...");
      expect(id).toBe("toast-id");
    });
  });

  describe("dismissLoading", () => {
    const { toast } = require("sonner");

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("dismisses toast and shows success", () => {
      dismissLoading("toast-id", { success: true, message: "Done!" });
      expect(toast.dismiss).toHaveBeenCalledWith("toast-id");
      expect(toast.success).toHaveBeenCalledWith("Done!", { description: undefined });
    });

    it("dismisses toast and shows error", () => {
      dismissLoading("toast-id", { success: false, message: "Failed!" });
      expect(toast.dismiss).toHaveBeenCalledWith("toast-id");
      expect(toast.error).toHaveBeenCalledWith("Failed!", { description: undefined });
    });

    it("includes description in success toast", () => {
      dismissLoading("toast-id", { success: true, message: "Done!", description: "All good" });
      expect(toast.success).toHaveBeenCalledWith("Done!", { description: "All good" });
    });
  });

  describe("withErrorHandling", () => {
    const { toast } = require("sonner");

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("returns success with data on success", async () => {
      const result = await withErrorHandling(async () => "data");
      expect(result).toEqual({ success: true, data: "data" });
    });

    it("returns error on failure", async () => {
      const result = await withErrorHandling(async () => {
        throw new Error("Failed");
      });
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Failed");
    });

    it("calls onSuccess callback", async () => {
      const onSuccess = jest.fn();
      await withErrorHandling(async () => "data", { onSuccess });
      expect(onSuccess).toHaveBeenCalledWith("data");
    });

    it("calls onError callback", async () => {
      const onError = jest.fn();
      await withErrorHandling(
        async () => {
          throw new Error("Failed");
        },
        { onError }
      );
      expect(onError).toHaveBeenCalled();
    });

    it("shows loading toast when showLoading is true", async () => {
      await withErrorHandling(async () => "data", { showLoading: true });
      expect(toast.loading).toHaveBeenCalled();
      expect(toast.dismiss).toHaveBeenCalled();
    });

    it("handles non-Error throws", async () => {
      const result = await withErrorHandling(async () => {
        throw "string error";
      });
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("string error");
    });
  });
});
