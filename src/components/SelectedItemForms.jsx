import { useNavigate } from "react-router-dom";
import FloorForm from "./forms/FloorForm";
import CeilingForm from "./forms/CeilingForm";
import FacingForm from "./forms/FacingForm";
import SoundboardForm from "./forms/SoundboardForm";
import ConstructionParameters from "./ConstructionParameters";

/**
 * Компонент для отображения форм выбранного элемента
 */
const SelectedItemForms = ({
  selectedItem,
  constR,
  setConstR,
  currentSubCategory,
  unvisible,
  setUnvisible,
  currentGkla,
  setCurrentGkla,
  currentWool,
  setCurrentWool,
  profileStep,
  setProfileStep,
  dFrame,
  setDFrame,
  opening,
  setOpening,
  constrSent,
  onAddOpening,
  onDeleteOpening,
}) => {
  const template = selectedItem?.template;
  const isFloorTemplate = [1, 111, 3, 607.1, 608.1, 609.1, 610.1, 2.1, 9, 9.1].includes(template);
  const isCeilingTemplate = [4, 5].includes(template);
  const isFacingTemplate = [6, 50, 75, 100, 101, 50.1, 75.1, 100.1, 101.1, 50.2, 75.2, 100.2, 8.1].includes(template);
  const isSoundboardTemplate = [201, 202].includes(template);
  const isVerticalSoundboard = template === 201 && selectedItem?.c_id === "5";
  const navigate = useNavigate();

  const getStartParam = () => {
    setUnvisible(!unvisible);
  };

  const handleInfoClick = () => {
    // Сохраняем c_id в sessionStorage для передачи в ItemInfo
    sessionStorage.setItem('itemInfo_c_id', selectedItem.c_id);
    navigate(`/info/${selectedItem.ag_id}`, { state: { c_id: selectedItem.c_id } });
  };

  return (
    <div className="selected-item-forms">
      <button
        type="button"
        className="selected-item-header"
        onClick={handleInfoClick}
        aria-label={`Информация: ${selectedItem.title}`}
        title="Информация"
      >
        <h3>{selectedItem.title}</h3>
        <span className="selected-item-header-icon" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
            <text x="10" y="14" textAnchor="middle" fontSize="14" fontWeight="bold" fill="currentColor" fontStyle="italic">i</text>
          </svg>
        </span>
      </button>

      {isFloorTemplate && (
        <FloorForm
          constR={constR}
          onLenXChange={(value) => setConstR({ ...constR, lenX: value })}
          onLenYChange={(value) => setConstR({ ...constR, lenY: value })}
        />
      )}

      {isCeilingTemplate && (
        <CeilingForm
          constR={constR}
          onLenXChange={(value) => setConstR({ ...constR, lenX: value })}
          onLenYChange={(value) => setConstR({ ...constR, lenY: value })}
          onAddCeilShiftChange={(value) =>
            setConstR({ ...constR, AddCeilShift: value })
          }
          showCeilShift={template === 5 && selectedItem.id === 503}
        />
      )}

      {isFacingTemplate && (
        <>
          <FacingForm
            constR={constR}
            onLenXChange={(value) => setConstR({ ...constR, lenX: value })}
            onLenZChange={(value) => setConstR({ ...constR, lenZ: value })}
            onShowParams={getStartParam}
            className={
              selectedItem.c_id == "W" ? "partittion50" : "frame50"
            }
          />
          {unvisible && (
            <ConstructionParameters
              selectedItem={selectedItem}
              currentSubCategory={currentSubCategory}
              currentGkla={currentGkla}
              setCurrentGkla={setCurrentGkla}
              currentWool={currentWool}
              setCurrentWool={setCurrentWool}
              profileStep={profileStep}
              setProfileStep={setProfileStep}
              dFrame={dFrame}
              setDFrame={setDFrame}
              opening={opening}
              setOpening={setOpening}
              openings={constrSent.Openings}
              onAddOpening={onAddOpening}
              onDeleteOpening={onDeleteOpening}
            />
          )}
        </>
      )}

      {isSoundboardTemplate && (
        <SoundboardForm
          constR={constR}
          onLenXChange={(value) => setConstR({ ...constR, lenX: value })}
          onLenYChange={(value) => setConstR({ ...constR, lenY: value })}
          onLenZChange={(value) => setConstR({ ...constR, lenZ: value })}
          isVertical={isVerticalSoundboard}
        />
      )}
    </div>
  );
};

export default SelectedItemForms;







