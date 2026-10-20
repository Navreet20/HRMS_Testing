import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotoControls } from "@/modules/employees/components/PhotoControls";
import { ui } from "@/modules/employees/uiClasses";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function PhotoHarness({
  hasPhoto = false,
  currentPhotoSrc = null as string | null,
  onUpload = jest.fn(),
  onRemove = jest.fn(),
  onError = jest.fn(),
  variant = "caption" as "caption" | "overlay",
}) {
  return (
    <div className={ui.profileHeroAvatarWrap}>
      <span className={ui.profileHeroAvatar} aria-hidden="true">
        {currentPhotoSrc ? (
          <img className={ui.profileHeroPhoto} src={currentPhotoSrc} alt="" />
        ) : (
          "AN"
        )}
      </span>
      <PhotoControls
        canEdit
        hasPhoto={hasPhoto}
        currentPhotoSrc={currentPhotoSrc}
        variant={variant}
        onUpload={onUpload}
        onRemove={onRemove}
        onError={onError}
      />
    </div>
  );
}

describe("PhotoControls editor", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        return 400;
      },
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get() {
        return 400;
      },
    });

    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      fillStyle: "",
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.toBlob = jest.fn(function toBlob(
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      callback(new Blob(["cropped"], { type: "image/jpeg" }));
    }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the crop editor after selecting a photo", async () => {
    const user = userEvent.setup();
    const onUpload = jest.fn();
    render(<PhotoHarness onUpload={onUpload} />);

    const file = new File([TINY_PNG], "avatar.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    await user.upload(input, file);

    expect(
      await screen.findByRole("dialog", { name: /edit profile photo/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /^zoom$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zoom out/i })).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("cancels without uploading", async () => {
    const user = userEvent.setup();
    const onUpload = jest.fn();
    render(<PhotoHarness onUpload={onUpload} />);

    const file = new File([TINY_PNG], "avatar.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    await screen.findByRole("dialog", { name: /edit profile photo/i });
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(
      screen.queryByRole("dialog", { name: /edit profile photo/i }),
    ).not.toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("saves a cropped file through onUpload", async () => {
    const user = userEvent.setup();
    const onUpload = jest.fn();
    render(<PhotoHarness onUpload={onUpload} />);

    const file = new File([TINY_PNG], "avatar.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    const dialog = await screen.findByRole("dialog", {
      name: /edit profile photo/i,
    });
    const img = dialog.querySelector("img");
    expect(img).toBeTruthy();
    await act(async () => {
      img!.dispatchEvent(new Event("load"));
    });

    const save = await screen.findByRole("button", { name: /^save$/i });
    await waitFor(() => {
      expect(save).toBeEnabled();
    });
    await user.click(save);

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(1);
    });
    const uploaded = onUpload.mock.calls[0][0] as File;
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded.type).toBe("image/jpeg");
    expect(uploaded.name).toBe("avatar.jpg");
    expect(
      screen.queryByRole("dialog", { name: /edit profile photo/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the editor when clicking an existing avatar photo", async () => {
    const user = userEvent.setup();
    render(
      <PhotoHarness
        variant="overlay"
        hasPhoto
        currentPhotoSrc={TINY_PNG}
      />,
    );

    const [avatarHit] = screen.getAllByRole("button", {
      name: /replace photo/i,
    });
    await user.click(avatarHit!);

    expect(
      await screen.findByRole("dialog", { name: /edit profile photo/i }),
    ).toBeInTheDocument();
  });

  it("rejects oversized files before opening the editor", async () => {
    const user = userEvent.setup();
    const onError = jest.fn();
    const onUpload = jest.fn();
    render(<PhotoHarness onUpload={onUpload} onError={onError} />);

    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, big);

    expect(onError).toHaveBeenCalledWith("Photo exceeds 2 MB limit");
    expect(
      screen.queryByRole("dialog", { name: /edit profile photo/i }),
    ).not.toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("updates zoom when using zoom controls", async () => {
    const user = userEvent.setup();
    const onUpload = jest.fn();
    render(<PhotoHarness onUpload={onUpload} />);

    const file = new File([TINY_PNG], "avatar.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    const dialog = await screen.findByRole("dialog", {
      name: /edit profile photo/i,
    });
    await act(async () => {
      dialog.querySelector("img")?.dispatchEvent(new Event("load"));
    });

    const slider = screen.getByRole("slider", {
      name: /^zoom$/i,
    }) as HTMLInputElement;
    expect(slider.value).toBe("1");
    await user.click(screen.getByRole("button", { name: /zoom in/i }));
    expect(Number(slider.value)).toBeGreaterThan(1);
  });
});
