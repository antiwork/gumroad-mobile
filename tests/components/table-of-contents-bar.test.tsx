import { TableOfContentsBar, ContentPage } from "@/components/table-of-contents-bar";
import { fireEvent, render, screen } from "@testing-library/react-native";

const mockPages: ContentPage[] = [
  { id: "page-1", name: "Introduction" },
  { id: "page-2", name: "Chapter 1" },
  { id: "page-3", name: "Chapter 2" },
];

const mockOnNavigate = jest.fn();

beforeEach(() => {
  mockOnNavigate.mockClear();
});

describe("TableOfContentsBar", () => {
  it("renders nothing when there is only one page", () => {
    const { toJSON } = render(
      <TableOfContentsBar pages={[mockPages[0]]} currentPageIndex={0} onNavigate={mockOnNavigate} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders nothing when there are no pages", () => {
    const { toJSON } = render(
      <TableOfContentsBar pages={[]} currentPageIndex={0} onNavigate={mockOnNavigate} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("displays the current page name and count", () => {
    render(<TableOfContentsBar pages={mockPages} currentPageIndex={1} onNavigate={mockOnNavigate} />);
    expect(screen.getByText("Chapter 1")).toBeTruthy();
    expect(screen.getByText("(2/3)")).toBeTruthy();
  });

  it("calls onNavigate with previous page index", () => {
    render(<TableOfContentsBar pages={mockPages} currentPageIndex={1} onNavigate={mockOnNavigate} />);
    fireEvent.press(screen.getByLabelText("Previous page"));
    expect(mockOnNavigate).toHaveBeenCalledWith(0);
  });

  it("calls onNavigate with next page index", () => {
    render(<TableOfContentsBar pages={mockPages} currentPageIndex={1} onNavigate={mockOnNavigate} />);
    fireEvent.press(screen.getByLabelText("Next page"));
    expect(mockOnNavigate).toHaveBeenCalledWith(2);
  });

  it("disables previous button on first page", () => {
    render(<TableOfContentsBar pages={mockPages} currentPageIndex={0} onNavigate={mockOnNavigate} />);
    const prevButton = screen.getByLabelText("Previous page");
    expect(prevButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("disables next button on last page", () => {
    render(<TableOfContentsBar pages={mockPages} currentPageIndex={2} onNavigate={mockOnNavigate} />);
    const nextButton = screen.getByLabelText("Next page");
    expect(nextButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("opens table of contents sheet when center button is pressed", () => {
    render(<TableOfContentsBar pages={mockPages} currentPageIndex={0} onNavigate={mockOnNavigate} />);
    fireEvent.press(screen.getByLabelText("Table of contents"));
    // All page names should be visible in the sheet (Introduction appears twice: bar + sheet)
    expect(screen.getAllByText("Introduction").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Chapter 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Chapter 2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Table of Contents")).toBeTruthy();
  });

  it("navigates when a page in the sheet is tapped", () => {
    render(<TableOfContentsBar pages={mockPages} currentPageIndex={0} onNavigate={mockOnNavigate} />);
    fireEvent.press(screen.getByLabelText("Table of contents"));
    fireEvent.press(screen.getByText("Chapter 2"));
    expect(mockOnNavigate).toHaveBeenCalledWith(2);
  });
});
