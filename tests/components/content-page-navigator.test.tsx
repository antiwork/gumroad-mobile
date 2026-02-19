import { ContentPage, ContentPageNavigator } from "@/components/content-page-navigator";
import { fireEvent, render, screen } from "@testing-library/react-native";

const pages: ContentPage[] = [
  { id: "page-1", title: "Introduction", icon: "file" },
  { id: "page-2", title: "Chapter 1", icon: "music" },
  { id: "page-3", title: "Chapter 2", icon: "video" },
];

const getTocButton = () => screen.getByRole("button", { name: /table of contents/i });

describe("ContentPageNavigator", () => {
  it("renders previous and next buttons", () => {
    const onPageChange = jest.fn();
    render(<ContentPageNavigator pages={pages} activeIndex={1} onPageChange={onPageChange} />);

    expect(screen.getByText("Previous")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("does not call onPageChange when pressing previous on first page", () => {
    const onPageChange = jest.fn();
    render(<ContentPageNavigator pages={pages} activeIndex={0} onPageChange={onPageChange} />);

    fireEvent.press(screen.getByText("Previous"));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("does not call onPageChange when pressing next on last page", () => {
    const onPageChange = jest.fn();
    render(<ContentPageNavigator pages={pages} activeIndex={2} onPageChange={onPageChange} />);

    fireEvent.press(screen.getByText("Next"));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("calls onPageChange with previous index when pressing previous", () => {
    const onPageChange = jest.fn();
    render(<ContentPageNavigator pages={pages} activeIndex={1} onPageChange={onPageChange} />);

    fireEvent.press(screen.getByText("Previous"));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("calls onPageChange with next index when pressing next", () => {
    const onPageChange = jest.fn();
    render(<ContentPageNavigator pages={pages} activeIndex={1} onPageChange={onPageChange} />);

    fireEvent.press(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("opens the TOC sheet and displays all page titles", () => {
    const onPageChange = jest.fn();
    render(<ContentPageNavigator pages={pages} activeIndex={0} onPageChange={onPageChange} />);

    fireEvent.press(getTocButton());

    expect(screen.getByText("Table of contents")).toBeTruthy();
    expect(screen.getByText("Introduction")).toBeTruthy();
    expect(screen.getByText("Chapter 1")).toBeTruthy();
    expect(screen.getByText("Chapter 2")).toBeTruthy();
  });

  it("marks the active page with a distinct style in the TOC sheet", () => {
    const onPageChange = jest.fn();
    render(<ContentPageNavigator pages={pages} activeIndex={1} onPageChange={onPageChange} />);

    fireEvent.press(getTocButton());

    const activeText = screen.getByText("Chapter 1");
    const inactiveText = screen.getByText("Introduction");
    expect(activeText.props.className).toContain("font-bold");
    expect(inactiveText.props.className).not.toContain("font-bold");
  });

  it("calls onPageChange when selecting a page from the TOC", () => {
    const onPageChange = jest.fn();
    render(<ContentPageNavigator pages={pages} activeIndex={0} onPageChange={onPageChange} />);

    fireEvent.press(getTocButton());
    fireEvent.press(screen.getByText("Chapter 2"));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("closes the TOC sheet after selecting a page", () => {
    const onPageChange = jest.fn();
    render(<ContentPageNavigator pages={pages} activeIndex={0} onPageChange={onPageChange} />);

    fireEvent.press(getTocButton());
    expect(screen.getByText("Table of contents")).toBeTruthy();

    fireEvent.press(screen.getByText("Chapter 1"));

    expect(screen.queryByText("Table of contents")).toBeNull();
  });
});
