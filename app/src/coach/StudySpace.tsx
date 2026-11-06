import { createContext, useContext } from "react";
import type { StudySpace } from "./types";

const Context = createContext<StudySpace>("capa1");
export const StudySpaceProvider = Context.Provider;
export const useStudySpace = () => useContext(Context);
