import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LOGIN_FEATURE_CAROUSEL_INTERVAL_MS,
  LOGIN_FEATURE_SLIDES,
  LoginFeatureCarousel,
} from "@/shell/LoginFeatureCarousel";

function activeDot() {
  return screen.getByRole("button", { current: true });
}

function visibleSlide() {
  const slides = screen.getAllByRole("group").filter((node) => {
    return node.getAttribute("aria-roledescription") === "slide";
  });
  return slides.find((node) => node.getAttribute("aria-hidden") !== "true");
}

describe("LoginFeatureCarousel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("exposes four labeled slides and starts on slide 1", () => {
    render(<LoginFeatureCarousel />);

    expect(LOGIN_FEATURE_SLIDES).toHaveLength(4);
    expect(LOGIN_FEATURE_SLIDES.map((slide) => slide.headline)).toEqual([
      "Your people, in one place.",
      "Timesheets and leave, approved faster.",
      "Every asset accounted for.",
      "Clients and projects, connected.",
    ]);
    expect(LOGIN_FEATURE_SLIDES.map((slide) => slide.body)).toEqual([
      "Employees, departments, locations and roles.",
      "Review, approve and track from one queue.",
      "Laptops, devices and who has them.",
      "Who is working on what, and for whom.",
    ]);
    expect(LOGIN_FEATURE_SLIDES.map((slide) => slide.image)).toEqual([
      "/login/people.svg",
      "/login/time-leave.svg",
      "/login/assets.svg",
      "/login/projects.svg",
    ]);

    expect(
      screen.getByRole("region", { name: /product features/i }),
    ).toHaveAttribute("aria-live", "off");
    expect(
      screen.getByRole("region", { name: /product features/i }),
    ).toHaveAttribute("aria-roledescription", "carousel");

    expect(activeDot()).toHaveAccessibleName("Slide 1 of 4");
    expect(visibleSlide()).toHaveTextContent("Your people, in one place.");
    expect(visibleSlide()).toHaveTextContent(
      "Employees, departments, locations and roles.",
    );

    for (let index = 0; index < LOGIN_FEATURE_SLIDES.length; index += 1) {
      expect(
        screen.getByRole("button", {
          name: `Slide ${index + 1} of 4`,
        }),
      ).toBeInTheDocument();
    }

    const activeMark = activeDot().querySelector("span");
    expect(activeMark?.className).toContain("bg-ds-accent");
    expect(
      screen.getByRole("button", { name: "Slide 2 of 4" }).querySelector("span")
        ?.className,
    ).toContain("bg-[color-mix");

    const slides = screen.getAllByRole("group").filter((node) => {
      return node.getAttribute("aria-roledescription") === "slide";
    });
    slides.forEach((slide, index) => {
      const image = slide.querySelector("img");
      const headline = slide.querySelector("p");
      expect(image).toBeTruthy();
      expect(image).toHaveAttribute("src", LOGIN_FEATURE_SLIDES[index].image);
      expect(image).toHaveAttribute("alt", "");
      expect(image).toHaveAttribute("aria-hidden", "true");
      expect(slide.firstElementChild).toBe(image);
      expect(image?.nextElementSibling).toBe(headline);
      expect(headline).toHaveTextContent(LOGIN_FEATURE_SLIDES[index].headline);
    });
  });

  it("auto-advances every 5s and pauses while hovered", () => {
    render(<LoginFeatureCarousel />);
    const carousel = screen.getByRole("region", { name: /product features/i });

    act(() => {
      jest.advanceTimersByTime(LOGIN_FEATURE_CAROUSEL_INTERVAL_MS - 1);
    });
    expect(activeDot()).toHaveAccessibleName("Slide 1 of 4");

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(activeDot()).toHaveAccessibleName("Slide 2 of 4");
    expect(visibleSlide()).toHaveTextContent("Timesheets and leave, approved faster.");

    fireEvent.mouseEnter(carousel);
    act(() => {
      jest.advanceTimersByTime(LOGIN_FEATURE_CAROUSEL_INTERVAL_MS * 3);
    });
    expect(activeDot()).toHaveAccessibleName("Slide 2 of 4");
    expect(visibleSlide()).toHaveTextContent("Timesheets and leave, approved faster.");

    fireEvent.mouseLeave(carousel);
    act(() => {
      jest.advanceTimersByTime(LOGIN_FEATURE_CAROUSEL_INTERVAL_MS);
    });
    expect(activeDot()).toHaveAccessibleName("Slide 3 of 4");
    expect(visibleSlide()).toHaveTextContent("Every asset accounted for.");
  });

  it("pauses auto-advance while a dot is focused and resumes after blur", () => {
    render(<LoginFeatureCarousel />);
    const firstDot = screen.getByRole("button", { name: "Slide 1 of 4" });

    act(() => {
      firstDot.focus();
    });
    fireEvent.focus(firstDot);

    act(() => {
      jest.advanceTimersByTime(LOGIN_FEATURE_CAROUSEL_INTERVAL_MS * 2);
    });
    expect(activeDot()).toHaveAccessibleName("Slide 1 of 4");

    fireEvent.blur(screen.getByRole("region", { name: /product features/i }));
    act(() => {
      jest.advanceTimersByTime(LOGIN_FEATURE_CAROUSEL_INTERVAL_MS);
    });
    expect(activeDot()).toHaveAccessibleName("Slide 2 of 4");
  });

  it("lets keyboard-operable dots jump to a labeled slide", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    render(<LoginFeatureCarousel />);

    const fourth = screen.getByRole("button", { name: "Slide 4 of 4" });
    expect(fourth).toHaveAttribute("type", "button");
    expect(fourth).not.toHaveAttribute("tabIndex", "-1");

    fourth.focus();
    expect(fourth).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(activeDot()).toHaveAccessibleName("Slide 4 of 4");
    expect(visibleSlide()).toHaveTextContent("Clients and projects, connected.");
    expect(visibleSlide()).toHaveTextContent(
      "Who is working on what, and for whom.",
    );

    const second = screen.getByRole("button", { name: "Slide 2 of 4" });
    second.focus();
    await user.keyboard(" ");
    expect(activeDot()).toHaveAccessibleName("Slide 2 of 4");
    expect(visibleSlide()).toHaveTextContent("Timesheets and leave, approved faster.");
  });
});
