type Props = {
  onAbandon: () => void;
};

/** 计时画面「放弃」：图标按钮，避免无法还原时卡在计时中。 */
export function TimingAbandonButton({ onAbandon }: Props) {
  return (
    <button
      type="button"
      className="timing-abandon"
      aria-label="放弃本次计时"
      title="放弃"
      onClick={onAbandon}
    >
      <svg
        className="timing-abandon-svg"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M6.4 6.4 12 12l5.6-5.6 1.4 1.4L13.4 13.4l5.6 5.6-1.4 1.4L12 14.8l-5.6 5.6-1.4-1.4 5.6-5.6-5.6-5.6z"
        />
      </svg>
    </button>
  );
}
