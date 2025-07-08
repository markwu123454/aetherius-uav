import { useNavigate } from "react-router-dom";

export default function Manual() {
  const navigate = useNavigate();

  const handleStartMission = () => {
    navigate("/mission-control");
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Manual Control</h1>
      <button
        onClick={handleStartMission}
        className="px-4 py-2 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded shadow"
      >
        Start Mission
      </button>
    </div>
  );
}
