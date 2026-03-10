import * as React from "react";
import { JSX } from "react/jsx-runtime";
const StatsWave = (props: JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>) =>
<svg
  width="100%"
  height="100%"
  id="svg"
  viewBox="0 0 1440 590"
  xmlns="http://www.w3.org/2000/svg"
  className="transition duration-300 ease-in-out delay-150"
  {...props}>
  
    <path
    d="M 0,600 L 0,225 C 92.25837320574166,205.66985645933016 184.51674641148333,186.3397129186603 276,184 C 367.4832535885167,181.6602870813397 458.1913875598085,196.31100478468898 566,215 C 673.8086124401915,233.68899521531102 798.7177033492824,256.4162679425837 893,244 C 987.2822966507176,231.58373205741628 1050.9377990430621,184.02392344497608 1137,175 C 1223.0622009569379,165.97607655502392 1331.531100478469,195.48803827751198 1440,225 L 1440,600 L 0,600 Z"
    stroke="none"
    strokeWidth={0}
    fill="#f8f6f2"
    fillOpacity={1} />
  
  </svg>;

export default StatsWave;