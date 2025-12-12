import { useRef, useEffect } from "react";

interface SentenceWithCommentsProps {
  videoId: string;
  sectionId: string;
  sentenceIndex: number;
  content: string;
  timestampStart: string;
  commentCount: number;
  hasNote?: boolean;
  isSelected?: boolean;
  onTimestampClick: (timestamp: string) => void;
  onSentenceSelect?: (
    info: {
      videoId: string;
      sectionId: string;
      sentenceIndex: number;
      content: string;
    } | null,
  ) => void;
  onDoubleClick?: (info: { sectionId: string; sentenceIndex: number; content: string }) => void;
}

export function SentenceWithComments({
  videoId,
  sectionId,
  sentenceIndex,
  content,
  timestampStart,
  commentCount,
  hasNote = false,
  isSelected = false,
  onTimestampClick,
  onSentenceSelect,
  onDoubleClick,
}: SentenceWithCommentsProps) {
  const sentenceRef = useRef<HTMLSpanElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef(false);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Handle mouse enter - start timer to select sentence
  const handleMouseEnter = () => {
    isHoveringRef.current = true;

    // Clear any existing timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    // Start new timer - select after 800ms hover
    hoverTimerRef.current = setTimeout(() => {
      if (isHoveringRef.current && onSentenceSelect) {
        onSentenceSelect({
          videoId,
          sectionId,
          sentenceIndex,
          content,
        });
      }
    }, 800);
  };

  // Handle mouse leave from sentence
  const handleMouseLeave = () => {
    isHoveringRef.current = false;

    // Clear the timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  // Handle click to jump to timestamp
  const handleSentenceClick = () => {
    onTimestampClick(timestampStart);
  };

  // Handle double-click to open note editor
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDoubleClick) {
      onDoubleClick({
        sectionId,
        sentenceIndex,
        content,
      });
    }
  };

  // Handle drag for chat feature (preserve existing functionality)
  const handleDragStart = (e: React.DragEvent<HTMLSpanElement>) => {
    e.dataTransfer.setData("text/plain", content);
    e.dataTransfer.effectAllowed = "copy";
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent<HTMLSpanElement>) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
  };

  return (
    <span className="relative inline">
      {/* Sentence text with badges */}
      <span
        ref={sentenceRef}
        draggable="true"
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleSentenceClick}
        onDoubleClick={handleDoubleClick}
        className={`cursor-pointer rounded-sm px-0.5 transition-all duration-200 ${
          hasNote
            ? "border-b-2 border-yellow-400 bg-yellow-100"
            : isSelected
              ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
              : "hover:bg-blue-50 hover:text-blue-900"
        }`}
        title={hasNote ? "双击编辑笔记" : "双击添加笔记"}
      >
        {content}
        {hasNote && (
          <span className="ml-1 inline-flex h-4 w-4 items-center justify-center text-yellow-600">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </span>
        )}
        {commentCount > 0 && (
          <span
            className={`ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium ${
              isSelected ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
            }`}
          >
            {commentCount}
          </span>
        )}
      </span>
    </span>
  );
}

export default SentenceWithComments;
