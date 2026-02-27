import { ContentPageNav } from "@/components/content-page-nav";
import { fireEvent, render, screen } from "@testing-library/react-native";

const makePages = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    page_id: `page-${i}`,
    title: `Page ${i + 1}`,
  }));

describe("ContentPageNav", () => {
  const onPageChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders page counter with correct position", () => {
    render(<ContentPageNav pages={makePages(5)} activePageIndex={2} onPageChange={onPageChange} />);
    expect(screen.getByText("3 of 5")).toBeTruthy();
  });

  it("calls onPageChange with previous index when Previous is pressed", () => {
    render(<ContentPageNav pages={makePages(3)} activePageIndex={1} onPageChange={onPageChange} />);
    fireEvent.press(screen.getByText("Previous"));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("calls onPageChange with next index when Next is pressed", () => {
    render(<ContentPageNav pages={makePages(3)} activePageIndex={0} onPageChange={onPageChange} />);
    fireEvent.press(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables Previous button on first page", () => {
    render(<ContentPageNav pages={makePages(3)} activePageIndex={0} onPageChange={onPageChange} />);
    fireEvent.press(screen.getByText("Previous"));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("disables Next button on last page", () => {
    render(<ContentPageNav pages={makePages(3)} activePageIndex={2} onPageChange={onPageChange} />);
    fireEvent.press(screen.getByText("Next"));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("displays page titles with 'Untitled' for null titles in sheet", () => {
    const pages = [
      { page_id: "p1", title: "Introduction" },
      { page_id: "p2", title: null },
    ];
    render(<ContentPageNav pages={pages} activePageIndex={0} onPageChange={onPageChange} />);
    fireEvent.press(screen.getByText("1 of 2"));
    expect(screen.getByText("Introduction")).toBeTruthy();
    expect(screen.getByText("Untitled")).toBeTruthy();
  });

  it("calls onPageChange when a page is selected in the sheet", () => {
    render(<ContentPageNav pages={makePages(3)} activePageIndex={0} onPageChange={onPageChange} />);
    fireEvent.press(screen.getByText("1 of 3"));
    fireEvent.press(screen.getByText("Page 3"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
