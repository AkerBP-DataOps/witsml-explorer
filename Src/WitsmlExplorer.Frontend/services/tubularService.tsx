import ApiClient from "./apiClient";
import Tubular from "../models/tubular";
import TubularComponent from "../models/tubularComponent";

export default class TubularService {
  public static async getTubulars(wellId: string, wellboreId: string, abortSignal?: AbortSignal): Promise<Tubular[]> {
    const response = await ApiClient.get(`/api/wells/${wellId}/wellbores/${wellboreId}/tubulars`, abortSignal);
    if (response.ok) {
      return response.json();
    } else {
      return [];
    }
  }

  public static async getTubularComponents(wellUid: string, wellboreUid: string, tubularId: string, abortSignal: AbortSignal): Promise<TubularComponent[]> {
    const response = await ApiClient.get(`/api/wells/${wellUid}/wellbores/${wellboreUid}/tubulars/${tubularId}/tubularcomponents`, abortSignal);
    if (response.ok) {
      return response.json();
    } else {
      return [];
    }
  }
}
