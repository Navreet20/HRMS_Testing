import {
  AVATAR_CROP_MAX_ZOOM,
  AVATAR_CROP_MIN_ZOOM,
  clampAvatarOffset,
  clampAvatarZoom,
  coverScale,
  displaySize,
} from "@/modules/employees/cropAvatar";

describe("cropAvatar", () => {
  it("computes cover scale so the shorter side fills the viewport", () => {
    expect(coverScale(800, 400, 200)).toBe(0.5);
    expect(coverScale(400, 800, 200)).toBe(0.5);
    expect(coverScale(200, 200, 200)).toBe(1);
  });

  it("scales display size by zoom", () => {
    expect(displaySize(400, 200, 200, 1)).toEqual({
      width: 400,
      height: 200,
    });
    expect(displaySize(400, 200, 200, 2)).toEqual({
      width: 800,
      height: 400,
    });
  });

  it("clamps offsets so the viewport stays covered", () => {
    // At zoom 1, 400x200 image covers 200 viewport: width room = (400-200)/2 = 100
    expect(
      clampAvatarOffset(400, 200, 200, 1, 500, -500),
    ).toEqual({ offsetX: 100, offsetY: 0 });
    expect(
      clampAvatarOffset(400, 200, 200, 1, -500, 500),
    ).toEqual({ offsetX: -100, offsetY: 0 });
  });

  it("clamps zoom to the supported range", () => {
    expect(clampAvatarZoom(0.2)).toBe(AVATAR_CROP_MIN_ZOOM);
    expect(clampAvatarZoom(9)).toBe(AVATAR_CROP_MAX_ZOOM);
    expect(clampAvatarZoom(1.5)).toBe(1.5);
  });
});
