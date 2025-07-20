import React, { useState } from 'react';
import type { ReviewCount } from '../types/FileDetails';

interface ReviewSectionProps {
  reviewCount: ReviewCount;
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({ reviewCount }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const totalReviews = (Object.values(reviewCount) as Array<number | undefined>).reduce(
    (sum: number, count: number | undefined): number => sum + (count || 0),
    0,
  );

  return (
    <div className="section">
      <button className="section-header" onClick={() => setIsExpanded(!isExpanded)} type="button">
        <span className={`section-chevron ${isExpanded ? '' : 'collapsed'}`}>▶</span>
        <span>レビュー ({totalReviews}件)</span>
      </button>
      <div className={`section-content ${isExpanded ? '' : 'collapsed'}`}>
        <div className="review-stats">
          <div className="review-stat">
            未対応: <span className="review-count">{reviewCount.open || 0}</span>
          </div>
          <div className="review-stat">
            対応中: <span className="review-count">{reviewCount.in_progress || 0}</span>
          </div>
          <div className="review-stat">
            解決済み: <span className="review-count">{reviewCount.resolved || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
