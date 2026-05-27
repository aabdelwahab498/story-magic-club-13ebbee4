
interface Option {
  id: string;
  label: string;
}

interface OptionSelectorProps {
  title: string;
  options: Option[];
  selected: Option;
  onChange: (option: Option) => void;
  bgColorClass: string;
}

const OptionSelector = ({ 
  title, 
  options, 
  selected, 
  onChange, 
  bgColorClass 
}: OptionSelectorProps) => {
  return (
    <div>
      <h4 className="font-semibold mb-3 text-kids-midnight">{title}:</h4>
      <div className="space-y-2">
        {options.map((option) => (
          <label 
            key={option.id}
            className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${
              selected.id === option.id ? bgColorClass : 'hover:bg-gray-50'
            }`}
          >
            <input 
              type="radio" 
              name={title.toLowerCase().replace(/\s+/g, '-')} 
              checked={selected.id === option.id}
              onChange={() => onChange(option)}
              className="hidden"
            />
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center border-kids-purple`}>
              {selected.id === option.id && <div className="w-3 h-3 rounded-full bg-kids-purple" />}
            </div>
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default OptionSelector;
