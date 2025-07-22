import React, { useState } from 'react';
import type { ForeshadowingData, ForeshadowingPoint } from '../types/FileDetails';

interface ForeshadowingSectionProps {
  foreshadowing?: ForeshadowingData;
  onPlantAdd: (plant: ForeshadowingPoint) => void;
  onPlantRemove: (index: number) => void;
  onPlantUpdate: (index: number, plant: ForeshadowingPoint) => void;
  onPayoffSet: (payoff: ForeshadowingPoint) => void;
  onPayoffRemove: () => void;
}

export const ForeshadowingSection: React.FC<ForeshadowingSectionProps> = ({
  foreshadowing,
  onPlantAdd,
  onPlantRemove,
  onPlantUpdate,
  onPayoffSet,
  onPayoffRemove,
}) => {
  const [plantsExpanded, setPlantsExpanded] = useState(true);
  const [payoffExpanded, setPayoffExpanded] = useState(true);
  const [showPlantForm, setShowPlantForm] = useState(false);
  const [showPayoffForm, setShowPayoffForm] = useState(false);
  const [editingPlantIndex, setEditingPlantIndex] = useState<number | null>(null);

  // フォーム用の状態
  const [plantLocation, setPlantLocation] = useState('');
  const [plantComment, setPlantComment] = useState('');
  const [payoffLocation, setPayoffLocation] = useState('');
  const [payoffComment, setPayoffComment] = useState('');

  const hasPlants = Boolean(foreshadowing?.plants && foreshadowing.plants.length > 0);
  const hasPayoff = Boolean(
    foreshadowing?.payoff &&
      foreshadowing.payoff.location &&
      foreshadowing.payoff.location.trim() !== '',
  );

  const handlePlantAdd = (): void => {
    if (plantLocation.trim()) {
      onPlantAdd({ location: plantLocation, comment: plantComment });
      setPlantLocation('');
      setPlantComment('');
      setShowPlantForm(false);
    }
  };

  const handlePlantEdit = (index: number): void => {
    if (foreshadowing?.plants && foreshadowing.plants[index]) {
      const plant = foreshadowing.plants[index];
      setPlantLocation(plant.location);
      setPlantComment(plant.comment);
      setEditingPlantIndex(index);
      setShowPlantForm(true);
    }
  };

  const handlePlantUpdate = (): void => {
    if (editingPlantIndex !== null && plantLocation.trim()) {
      onPlantUpdate(editingPlantIndex, { location: plantLocation, comment: plantComment });
      setPlantLocation('');
      setPlantComment('');
      setEditingPlantIndex(null);
      setShowPlantForm(false);
    }
  };

  const handlePayoffSet = (): void => {
    if (payoffLocation.trim()) {
      onPayoffSet({ location: payoffLocation, comment: payoffComment });
      setPayoffLocation('');
      setPayoffComment('');
      setShowPayoffForm(false);
    }
  };

  const handlePayoffEdit = (): void => {
    if (foreshadowing?.payoff) {
      setPayoffLocation(foreshadowing.payoff.location);
      setPayoffComment(foreshadowing.payoff.comment);
      setShowPayoffForm(true);
    }
  };

  const cancelPlantForm = (): void => {
    setPlantLocation('');
    setPlantComment('');
    setEditingPlantIndex(null);
    setShowPlantForm(false);
  };

  const cancelPayoffForm = (): void => {
    setPayoffLocation('');
    setPayoffComment('');
    setShowPayoffForm(false);
  };

  return (
    <div className="section">
      <div className="section-header">
        <h3>🔮 伏線管理</h3>
      </div>

      {/* 植込み位置セクション */}
      <div className="subsection">
        <div
          className="subsection-header clickable"
          onClick={() => setPlantsExpanded(!plantsExpanded)}
        >
          <span className="collapse-icon">{plantsExpanded ? '▼' : '▶'}</span>
          <span>📍 伏線設置 ({hasPlants ? (foreshadowing?.plants?.length ?? 0) : 0}件)</span>
        </div>

        {plantsExpanded && (
          <div className="subsection-content">
            {hasPlants &&
              foreshadowing?.plants?.map((plant, index) => (
                <div key={index} className="foreshadowing-item">
                  <div className="foreshadowing-location">
                    <strong>{plant.location}</strong>
                  </div>
                  <div className="foreshadowing-comment">{plant.comment}</div>
                  <div className="foreshadowing-actions">
                    <button className="btn-secondary" onClick={() => handlePlantEdit(index)}>
                      編集
                    </button>
                    <button className="btn-danger" onClick={() => onPlantRemove(index)}>
                      削除
                    </button>
                  </div>
                </div>
              ))}

            {!showPlantForm && (
              <button className="btn-primary add-button" onClick={() => setShowPlantForm(true)}>
                + 位置を追加
              </button>
            )}

            {showPlantForm && (
              <div className="form-container">
                <div className="form-group">
                  <label>ファイルパス:</label>
                  <input
                    type="text"
                    value={plantLocation}
                    onChange={(e) => setPlantLocation(e.target.value)}
                    placeholder="例: contents/chapter1.txt"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>コメント:</label>
                  <textarea
                    value={plantComment}
                    onChange={(e) => setPlantComment(e.target.value)}
                    placeholder="伏線の内容や目的を説明"
                    className="form-textarea"
                    rows={2}
                  />
                </div>
                <div className="form-actions">
                  <button
                    className="btn-primary"
                    onClick={editingPlantIndex !== null ? handlePlantUpdate : handlePlantAdd}
                  >
                    {editingPlantIndex !== null ? '更新' : '追加'}
                  </button>
                  <button className="btn-secondary" onClick={cancelPlantForm}>
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 回収位置セクション */}
      <div className="subsection">
        <div
          className="subsection-header clickable"
          onClick={() => setPayoffExpanded(!payoffExpanded)}
        >
          <span className="collapse-icon">{payoffExpanded ? '▼' : '▶'}</span>
          <span>🎯 伏線回収 {hasPayoff ? '(設定済み)' : '(未設定)'}</span>
        </div>

        {payoffExpanded && (
          <div className="subsection-content">
            {hasPayoff && foreshadowing?.payoff && (
              <div className="foreshadowing-item">
                <div className="foreshadowing-location">
                  <strong>{foreshadowing.payoff.location}</strong>
                </div>
                <div className="foreshadowing-comment">{foreshadowing.payoff.comment}</div>
                <div className="foreshadowing-actions">
                  <button className="btn-secondary" onClick={handlePayoffEdit}>
                    編集
                  </button>
                  <button className="btn-danger" onClick={onPayoffRemove}>
                    削除
                  </button>
                </div>
              </div>
            )}

            {!hasPayoff && !showPayoffForm && (
              <button className="btn-primary add-button" onClick={() => setShowPayoffForm(true)}>
                + 回収位置を設定
              </button>
            )}

            {showPayoffForm && (
              <div className="form-container">
                <div className="form-group">
                  <label>ファイルパス:</label>
                  <input
                    type="text"
                    value={payoffLocation}
                    onChange={(e) => setPayoffLocation(e.target.value)}
                    placeholder="例: contents/chapter5.txt"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>コメント:</label>
                  <textarea
                    value={payoffComment}
                    onChange={(e) => setPayoffComment(e.target.value)}
                    placeholder="伏線の回収方法や結果を説明"
                    className="form-textarea"
                    rows={2}
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-primary" onClick={handlePayoffSet}>
                    設定
                  </button>
                  <button className="btn-secondary" onClick={cancelPayoffForm}>
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
