import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

import { useAuth } from "@/hooks/use-auth";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "new-project-id" });
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  test("isLoading is false initially", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  // -------------------------------------------------------------------------
  // signIn — loading state
  // -------------------------------------------------------------------------

  test("sets isLoading to true while signIn is in flight", async () => {
    let resolveSignIn!: (v: unknown) => void;
    mockSignInAction.mockReturnValue(
      new Promise((res) => { resolveSignIn = res; })
    );

    const { result } = renderHook(() => useAuth());

    act(() => { result.current.signIn("a@b.com", "pw"); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolveSignIn({ success: false }); });
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false after signIn resolves", async () => {
    mockSignInAction.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false when signIn throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pw").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  // -------------------------------------------------------------------------
  // signUp — loading state
  // -------------------------------------------------------------------------

  test("sets isLoading to true while signUp is in flight", async () => {
    let resolveSignUp!: (v: unknown) => void;
    mockSignUpAction.mockReturnValue(
      new Promise((res) => { resolveSignUp = res; })
    );

    const { result } = renderHook(() => useAuth());

    act(() => { result.current.signUp("a@b.com", "pw"); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolveSignUp({ success: false }); });
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false after signUp resolves", async () => {
    mockSignUpAction.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("a@b.com", "pw"); });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false when signUp throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("a@b.com", "pw").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  // -------------------------------------------------------------------------
  // signIn — return value
  // -------------------------------------------------------------------------

  test("signIn passes email and password to signInAction", async () => {
    mockSignInAction.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "secret123");
    });

    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "secret123");
  });

  test("signIn returns the result from signInAction on failure", async () => {
    const serverResult = { success: false, error: "invalid credentials" };
    mockSignInAction.mockResolvedValue(serverResult);

    const { result } = renderHook(() => useAuth());
    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "wrong");
    });

    expect(returnValue).toEqual(serverResult);
  });

  test("signIn returns the result from signInAction on success", async () => {
    const serverResult = { success: true };
    mockSignInAction.mockResolvedValue(serverResult);
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());
    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "pw");
    });

    expect(returnValue).toEqual(serverResult);
  });

  // -------------------------------------------------------------------------
  // signUp — return value
  // -------------------------------------------------------------------------

  test("signUp passes email and password to signUpAction", async () => {
    mockSignUpAction.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "pass456");
    });

    expect(mockSignUpAction).toHaveBeenCalledWith("new@example.com", "pass456");
  });

  test("signUp returns the result from signUpAction on failure", async () => {
    const serverResult = { success: false, error: "email taken" };
    mockSignUpAction.mockResolvedValue(serverResult);

    const { result } = renderHook(() => useAuth());
    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signUp("a@b.com", "pw");
    });

    expect(returnValue).toEqual(serverResult);
  });

  // -------------------------------------------------------------------------
  // Failed auth — no post-sign-in side effects
  // -------------------------------------------------------------------------

  test("does not call handlePostSignIn when signIn fails", async () => {
    mockSignInAction.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("does not call handlePostSignIn when signUp fails", async () => {
    mockSignUpAction.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("a@b.com", "pw"); });

    expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // handlePostSignIn — anonymous work with messages
  // -------------------------------------------------------------------------

  test("promotes anon work: creates project with anon data and navigates to it", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    const anonWork = {
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/": { type: "directory" }, "/App.jsx": { type: "file" } },
    };
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "anon-proj-id" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(mockCreateProject).toHaveBeenCalledWith({
      name: expect.stringMatching(/^Design from /),
      messages: anonWork.messages,
      data: anonWork.fileSystemData,
    });
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-proj-id");
  });

  test("does not call getProjects when anon work with messages exists", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "proj-x" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("does not promote anon work when messages array is empty", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });

  test("clears anon work before navigating away", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "proj-y" });

    const callOrder: string[] = [];
    mockClearAnonWork.mockImplementation(() => { callOrder.push("clear"); });
    mockPush.mockImplementation(() => { callOrder.push("push"); });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(callOrder).toEqual(["clear", "push"]);
  });

  // -------------------------------------------------------------------------
  // handlePostSignIn — no anon work, existing projects
  // -------------------------------------------------------------------------

  test("navigates to most recent project when user has projects", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([
      { id: "recent-proj" },
      { id: "older-proj" },
    ]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(mockPush).toHaveBeenCalledWith("/recent-proj");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("does not create a new project when existing projects are found", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("uses first element of projects array as most recent", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([
      { id: "first" },
      { id: "second" },
      { id: "third" },
    ]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(mockPush).toHaveBeenCalledWith("/first");
  });

  // -------------------------------------------------------------------------
  // handlePostSignIn — no anon work, no existing projects
  // -------------------------------------------------------------------------

  test("creates a new project when user has no projects", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(mockCreateProject).toHaveBeenCalledWith({
      name: expect.stringMatching(/^New Design #\d+/),
      messages: [],
      data: {},
    });
    expect(mockPush).toHaveBeenCalledWith("/brand-new");
  });

  test("new project name contains a numeric suffix", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "proj-new" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    const callArg = mockCreateProject.mock.calls[0][0];
    expect(callArg.name).toMatch(/^New Design #\d+$/);
  });

  // -------------------------------------------------------------------------
  // handlePostSignIn — anon work is null
  // -------------------------------------------------------------------------

  test("falls through to getProjects when getAnonWorkData returns null", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "proj-exists" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });

    expect(mockGetProjects).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/proj-exists");
  });

  // -------------------------------------------------------------------------
  // signUp triggers the same post-auth flow
  // -------------------------------------------------------------------------

  test("signUp also promotes anon work on success", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "signup-proj" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@example.com", "pw"); });

    expect(mockCreateProject).toHaveBeenCalled();
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/signup-proj");
  });

  test("signUp navigates to most recent project when no anon work", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "existing" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@example.com", "pw"); });

    expect(mockPush).toHaveBeenCalledWith("/existing");
  });

  test("signUp creates a new project when user has no projects", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "fresh-proj" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@example.com", "pw"); });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/fresh-proj");
  });
});
